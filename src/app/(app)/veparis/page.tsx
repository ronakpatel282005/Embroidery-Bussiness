'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import AddVepariModal from '@/components/veparis/AddVepariModal'
import EditVepariModal, { VepariEditData } from '@/components/veparis/EditVepariModal'
import ReceivePaymentModal from '@/components/veparis/ReceivePaymentModal'
import { autoLinkVeparis } from '@/lib/autoLinker'
import {
  Users,
  Plus,
  Search,
  ArrowUpRight,
  Receipt,
  Phone,
  MapPin,
  MessageCircle,
  Edit2,
  Trash2,
} from 'lucide-react'

interface VepariRecord {
  id: string
  name: string
  phone: string | null
  address: string | null
  opening_balance: number
  total_paid: number
  outstanding_balance: number
  linked_business_id: string | null
}

export default function VeparisPage() {
  const [veparis, setVeparis] = useState<VepariRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingVepari, setEditingVepari] = useState<VepariEditData | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedVepariForPayment, setSelectedVepariForPayment] = useState<{ id: string; name: string } | null>(null)

  const supabase = createClient()

  const handleEditVepari = (v: VepariRecord) => {
    setEditingVepari({
      id: v.id,
      name: v.name,
      phone: v.phone,
      address: v.address,
      opening_balance: v.opening_balance,
    })
    setIsEditModalOpen(true)
  }

  const handleDeleteVepari = async (v: VepariRecord) => {
    const ok = window.confirm(`Are you sure you want to delete vepari "${v.name}"? This action cannot be undone.`)
    if (!ok) return

    const { error: err } = await supabase.from('veparis').delete().eq('id', v.id)
    if (err) {
      alert(`Cannot delete: ${err.message}`)
    } else {
      loadVeparis()
    }
  }

  const loadVeparis = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return
    setBusinessId(business.id)

    // 1. Fetch veparis
    const { data: rawVeparis, error: vErr } = await supabase
      .from('veparis')
      .select('*')
      .eq('business_id', business.id)
      .order('name', { ascending: true })

    if (vErr || !rawVeparis) {
      setLoading(false)
      return
    }

    const { veparis: veparisData } = await autoLinkVeparis(
      supabase,
      business.id,
      rawVeparis as VepariRecord[]
    )

    // 2. Fetch payments made by all veparis
    const { data: paymentsData } = await supabase
      .from('vepari_payments')
      .select('vepari_id, amount')
      .eq('business_id', business.id)

    const paymentsByVepari: Record<string, number> = {}
    paymentsData?.forEach((p) => {
      paymentsByVepari[p.vepari_id] = (paymentsByVepari[p.vepari_id] || 0) + Number(p.amount)
    })

    // 3. Fetch lots amounts made by all veparis
    const { data: lotsData } = await supabase
      .from('lots')
      .select('vepari_id, total_amount')
      .eq('business_id', business.id)

    const lotsByVepari: Record<string, number> = {}
    lotsData?.forEach((l) => {
      lotsByVepari[l.vepari_id] = (lotsByVepari[l.vepari_id] || 0) + Number(l.total_amount)
    })

    // Compute balance = opening_balance + lots_amount - total_paid
    const formatted: VepariRecord[] = veparisData.map((v) => {
      const paid = paymentsByVepari[v.id] || 0
      const opening = Number(v.opening_balance) || 0
      const lotsTotal = lotsByVepari[v.id] || 0
      const balance = opening + lotsTotal - paid
      return {
        id: v.id,
        name: v.name,
        phone: v.phone,
        address: v.address,
        opening_balance: opening,
        total_paid: paid,
        outstanding_balance: balance,
        linked_business_id: v.linked_business_id,
      }
    })

    setVeparis(formatted)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadVeparis()
  }, [loadVeparis])

  // Filtered by search
  const filtered = veparis.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.phone && v.phone.includes(search)) ||
      (v.address && v.address.toLowerCase().includes(search.toLowerCase()))
  )

  // Totals
  const totalReceivable = veparis.reduce((sum, v) => sum + Math.max(0, v.outstanding_balance), 0)
  const totalCollected = veparis.reduce((sum, v) => sum + v.total_paid, 0)

  const handleOpenPayment = (vepari: VepariRecord) => {
    setSelectedVepariForPayment({ id: vepari.id, name: vepari.name })
    setIsPaymentModalOpen(true)
  }

  const generateWhatsAppReminder = (vepari: VepariRecord) => {
    if (!vepari.phone) return ''
    const cleanPhone = vepari.phone.replace(/[^0-9]/g, '')
    const msg = encodeURIComponent(
      `Hello ${vepari.name},\nThis is a payment reminder for your embroidery lot balance.\nTotal Outstanding Due: ${formatCurrency(
        vepari.outstanding_balance
      )}.\nPlease arrange the payment at your earliest convenience. Thank you!`
    )
    return `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${msg}`
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veparis (Traders)</h1>
          <p className="text-gray-500 mt-1">
            Manage your clients, track outstanding balances, and record payments received.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedVepariForPayment(null)
              setIsPaymentModalOpen(true)
            }}
            disabled={veparis.length === 0}
          >
            <Receipt className="w-4 h-4 mr-2 text-indigo-600" />
            Receive Payment
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Vepari
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Veparis</p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{veparis.length}</p>
          <p className="text-xs text-gray-400 mt-1">Registered clients</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total to Collect</p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{formatCurrency(totalReceivable)}</p>
          <p className="text-xs text-gray-400 mt-1">Outstanding receivable balance</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Collected</p>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(totalCollected)}</p>
          <p className="text-xs text-gray-400 mt-1">Total payments received to date</p>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by vepari name, phone, or market address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 whitespace-nowrap">
            Showing {filtered.length} of {veparis.length} veparis
          </p>
        </div>

        {/* Veparis Table */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading veparis & ledgers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-800">No Veparis Found</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'No veparis match your search query.'
                : 'You have not added any veparis yet. Add your first trader to start managing lots and payments.'}
            </p>
            {!search && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Your First Vepari
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">Vepari Name</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5 text-right">Opening Bal.</th>
                  <th className="px-6 py-3.5 text-right">Total Paid</th>
                  <th className="px-6 py-3.5 text-right">Outstanding Due</th>
                  <th className="px-6 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/75 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4">
                      <Link
                        href={`/veparis/${v.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline block"
                      >
                        {v.name}
                      </Link>
                      {v.linked_business_id && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-2xs font-semibold bg-blue-50 text-blue-700 rounded-md">
                          Linked Business
                        </span>
                      )}
                      {v.address && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 line-clamp-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span>{v.address}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4">
                      {v.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700">{v.phone}</span>
                          <a
                            href={generateWhatsAppReminder(v)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Opening Balance */}
                    <td className="px-6 py-4 text-right font-medium text-gray-600">
                      {formatCurrency(v.opening_balance)}
                    </td>

                    {/* Total Paid */}
                    <td className="px-6 py-4 text-right font-medium text-green-600">
                      {formatCurrency(v.total_paid)}
                    </td>

                    {/* Outstanding Balance */}
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block font-semibold px-2.5 py-1 rounded-md text-xs ${
                          v.outstanding_balance > 0
                            ? 'bg-amber-50 text-amber-700 font-bold'
                            : v.outstanding_balance < 0
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {formatCurrency(v.outstanding_balance)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link href={`/veparis/${v.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                            Ledger
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs px-2.5 bg-green-600 hover:bg-green-700"
                          onClick={() => handleOpenPayment(v)}
                        >
                          + Receive
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleEditVepari(v)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                          title="Edit Vepari Information"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVepari(v)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                          title="Delete Vepari"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Vepari Modal */}
      {businessId && (
        <AddVepariModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          businessId={businessId}
          onVepariAdded={() => loadVeparis()}
        />
      )}

      {/* Edit Vepari Modal */}
      <EditVepariModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingVepari(null)
        }}
        vepari={editingVepari}
        onVepariUpdated={() => loadVeparis()}
      />

      {/* Receive Payment Modal */}
      {businessId && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false)
            setSelectedVepariForPayment(null)
          }}
          businessId={businessId}
          vepariId={selectedVepariForPayment?.id}
          vepariName={selectedVepariForPayment?.name}
          veparisList={veparis.map((v) => ({ id: v.id, name: v.name }))}
          onPaymentRecorded={() => loadVeparis()}
        />
      )}
    </div>
  )
}
