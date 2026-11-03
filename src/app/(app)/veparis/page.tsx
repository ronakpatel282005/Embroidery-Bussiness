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
import { DEMO_VEPARIS } from '@/lib/demoData'
import { useLanguage } from '@/context/LanguageContext'
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

  const { language } = useLanguage()

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

    const isDemo = typeof document !== 'undefined' && document.cookie.includes('demo_mode=true')

    let user = null
    let business = null
    try {
      const userRes = await supabase.auth.getUser()
      user = userRes.data?.user || null
      if (user) {
        const bizRes = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .single()
        business = bizRes.data
      }
    } catch {
      // offline
    }

    if (isDemo || !user || !business) {
      setBusinessId('demo-biz-radhe-01')
      const formatted: VepariRecord[] = DEMO_VEPARIS.map((v) => ({
        id: v.id,
        name: v.name,
        phone: v.phone,
        address: v.market_name,
        opening_balance: v.opening_balance,
        total_paid: v.total_received,
        outstanding_balance: v.balance,
        linked_business_id: null,
      }))
      setVeparis(formatted)
      setLoading(false)
      return
    }

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
    const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone

    const text =
      language === 'gu'
        ? `નમસ્તે ${vepari.name},\nરાધે એમ્બ્રોઇડરી (સુરત) તરફથી નમ્ર વિનંતી:\nતમારા ખાતાની કુલ બાકી રકમ ${formatCurrency(vepari.outstanding_balance)} છે.\nકૃપા કરીને રકમ જમા કરાવવા અથવા હિસાબ મિલાવવા સંપર્ક કરશો. આભાર!`
        : language === 'hi'
        ? `नमस्ते ${vepari.name},\nराधे एम्ब्रॉयडरी की ओर से सादर प्रणाम:\nआपके खाते का कुल बकाया ${formatCurrency(vepari.outstanding_balance)} है।\nकृपया भुगतान के लिए संपर्क करें। धन्यवाद!`
        : `Hello ${vepari.name},\nThis is a payment reminder for your embroidery account.\nTotal Outstanding Due: ${formatCurrency(vepari.outstanding_balance)}.\nPlease arrange the clearance at your earliest convenience. Thank you!`

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xs uppercase tracking-wider font-mono font-bold text-slate-400">
              Commercial Accounts
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-3xs uppercase tracking-wider font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Trade Ledger
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700" />
            Veparis & Trade Clients
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your client accounts, outstanding lot balances, and recorded receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedVepariForPayment(null)
              setIsPaymentModalOpen(true)
            }}
            disabled={veparis.length === 0}
            className="shadow-2xs h-9 text-xs"
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Receive Payment
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="shadow-2xs h-9 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add New Vepari
          </Button>
        </div>
      </div>

      {/* Unified Financial Ribbon */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Total Clients
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums">
                {veparis.length}
              </span>
              <span className="text-xs text-slate-400 font-mono">Traders</span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">Active client accounts</p>
          </div>

          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Outstanding Due to Receive
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono tabular-nums">
                {formatCurrency(totalReceivable)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">Pending client collections</p>
          </div>

          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Total Payments Collected
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-nums">
                {formatCurrency(totalCollected)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">Total receipts to date</p>
          </div>
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by vepari name, phone, or market..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-white border-slate-200"
            />
          </div>
          <p className="text-2xs font-mono text-slate-500 whitespace-nowrap">
            {filtered.length} of {veparis.length} clients
          </p>
        </div>

        {/* Veparis Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-slate-700 border-t-transparent rounded-full mx-auto mb-3" />
            Loading accounts & ledgers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Veparis Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'No veparis match your search query.'
                : 'You have not added any veparis yet. Add your first trader to start managing lots and payments.'}
            </p>
            {!search && (
              <Button onClick={() => setIsAddModalOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Your First Vepari
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-2xs uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Vepari Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3 text-right">Opening Bal.</th>
                  <th className="px-5 py-3 text-right">Total Paid</th>
                  <th className="px-5 py-3 text-right">Outstanding Due</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-3">
                      <Link
                        href={`/veparis/${v.id}`}
                        className="font-bold text-slate-900 hover:text-slate-600 hover:underline block text-xs"
                      >
                        {v.name}
                      </Link>
                      {v.linked_business_id && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 text-3xs font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                          Linked Business
                        </span>
                      )}
                      {v.address && (
                        <div className="flex items-center gap-1 text-3xs text-slate-400 mt-0.5 line-clamp-1">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                          <span>{v.address}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3">
                      {v.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700">{v.phone}</span>
                          <a
                            href={generateWhatsAppReminder(v)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Opening Balance */}
                    <td className="px-5 py-3 text-right font-mono font-medium text-xs text-slate-600 tabular-nums">
                      {formatCurrency(v.opening_balance)}
                    </td>

                    {/* Total Paid */}
                    <td className="px-5 py-3 text-right font-mono font-semibold text-xs text-emerald-700 tabular-nums">
                      {formatCurrency(v.total_paid)}
                    </td>

                    {/* Outstanding Balance */}
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs tabular-nums ${
                          v.outstanding_balance > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : v.outstanding_balance < 0
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {formatCurrency(v.outstanding_balance)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link href={`/veparis/${v.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-slate-700 border-slate-200 hover:bg-slate-50">
                            Ledger
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => handleOpenPayment(v)}
                          className="h-7 text-xs px-2 bg-slate-900 hover:bg-slate-800 text-white"
                        >
                          <Receipt className="w-3 h-3 mr-1 text-emerald-400" />
                          Payment
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleEditVepari(v)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                          title="Edit Vepari"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVepari(v)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
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
