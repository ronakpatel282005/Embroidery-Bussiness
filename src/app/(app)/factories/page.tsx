'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  Factory as FactoryIcon,
  Plus,
  Search,
  MessageCircle,
  Phone,
  Edit2,
  Trash2,
  Building2,
  Send,
} from 'lucide-react'
import AddFactoryModal, { FactoryOption } from '@/components/factories/AddFactoryModal'
import EditFactoryModal from '@/components/factories/EditFactoryModal'
import PayFactoryModal from '@/components/factories/PayFactoryModal'

export default function FactoriesDirectoryPage() {
  const supabase = createClient()

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [factories, setFactories] = useState<FactoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [totalPayable, setTotalPayable] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingFactory, setEditingFactory] = useState<FactoryOption | null>(null)
  const [payingFactory, setPayingFactory] = useState<FactoryOption | null>(null)

  const loadFactories = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      setLoading(false)
      return
    }
    setBusinessId(business.id)

    // Fetch factories, allotments & payments in parallel
    const [factoriesRes, allotsRes, paysRes] = await Promise.all([
      supabase
        .from('factories')
        .select('*')
        .eq('business_id', business.id)
        .order('is_own', { ascending: false })
        .order('name', { ascending: true }),
      supabase
        .from('lot_allotments')
        .select('total_amount, factories(is_own)')
        .eq('business_id', business.id),
      supabase
        .from('factory_payments')
        .select('amount')
        .eq('business_id', business.id),
    ])

    if (!factoriesRes.error && factoriesRes.data) {
      setFactories(factoriesRes.data as FactoryOption[])
    }

    const totalExternalCost = (allotsRes.data || [])
      .filter((a: any) => !a.factories?.is_own)
      .reduce((sum: number, a: any) => sum + Number(a.total_amount || 0), 0)
    const totalPaymentsMade = (paysRes.data || []).reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    )

    setTotalPayable(Math.max(0, totalExternalCost - totalPaymentsMade))
    setTotalPaid(totalPaymentsMade)

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadFactories()
  }, [loadFactories])

  const handleDeleteFactory = async (factory: FactoryOption) => {
    if (factory.is_own) {
      alert('You cannot delete your default in-house factory ("My Own Factory").')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete factory "${factory.name}"?\n\nThis will remove it from your factory contacts.`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('factories').delete().eq('id', factory.id)
    if (delErr) {
      alert(`Cannot delete factory: ${delErr.message}`)
    } else {
      loadFactories()
    }
  }

  const filtered = factories.filter((f) => {
    const q = search.toLowerCase()
    return (
      f.name.toLowerCase().includes(q) ||
      (f.owner_name && f.owner_name.toLowerCase().includes(q)) ||
      (f.phone && f.phone.includes(q))
    )
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xs uppercase tracking-wider font-mono font-bold text-slate-400">
              Manufacturing Capacity
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-3xs uppercase tracking-wider font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Floor Network
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FactoryIcon className="w-6 h-6 text-slate-700" />
            Factories & Production Units
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your internal embroidery floor, external job work units, and settlement ledgers.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          size="default"
          className="shadow-2xs h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add New Factory
        </Button>
      </div>

      {/* Unified Executive Factory Metric Strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Total Outstanding Payable
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono tabular-nums">
                {formatCurrency(totalPayable)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">Pending to outside embroidery units</p>
          </div>

          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Total Disbursed Payments
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-nums">
                {formatCurrency(totalPaid)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">Recorded outbound challan payments</p>
          </div>

          <div className="p-4 sm:p-5">
            <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
              Registered Floor Units
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums">
                {factories.length}
              </span>
              <span className="text-xs text-slate-400 font-mono">Facilities</span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              {factories.filter((f) => !f.is_own).length} Partner Units &bull; {factories.filter((f) => f.is_own).length} In-House Floor
            </p>
          </div>
        </div>
      </div>

      {/* Factories Directory Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by factory name, owner, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-white border-slate-200"
            />
          </div>
          <p className="text-2xs font-mono text-slate-500 whitespace-nowrap">
            {filtered.length} of {factories.length} factories
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-slate-700 border-t-transparent rounded-full mx-auto mb-3" />
            Loading production facilities...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FactoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No Factories Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'No factories match your search query.'
                : 'Click below to register your first partner embroidery factory.'}
            </p>
            {!search && (
              <Button onClick={() => setIsAddOpen(true)} size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Factory
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-2xs uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Factory Name</th>
                  <th className="px-5 py-3">Unit Type</th>
                  <th className="px-5 py-3">Contact Person</th>
                  <th className="px-5 py-3">Mobile / WhatsApp</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {f.is_own ? (
                            <Building2 className="w-3.5 h-3.5 text-slate-900" />
                          ) : (
                            <FactoryIcon className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900 text-xs">{f.name}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3">
                      {f.is_own ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-semibold bg-slate-900 text-white font-mono">
                          <Building2 className="w-2.5 h-2.5" />
                          In-House (Own Floor)
                        </span>
                      ) : f.linked_business_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Linked Partner
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                          Offline Job Work
                        </span>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-3 text-xs text-slate-700">
                      {f.owner_name || <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* Contact & WhatsApp */}
                    <td className="px-5 py-3">
                      {f.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700">{f.phone}</span>
                          <a
                            href={`https://wa.me/${f.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link href={`/factories/${f.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-slate-700 border-slate-200 hover:bg-slate-50">
                            Ledger
                          </Button>
                        </Link>
                        {!f.is_own && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 bg-slate-900 hover:bg-slate-800 text-white"
                            onClick={() => setPayingFactory(f)}
                          >
                            Pay
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingFactory(f)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                          title="Edit Factory"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!f.is_own && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFactory(f)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Delete Factory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Factory Modal */}
      {businessId && (
        <AddFactoryModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          businessId={businessId}
          onFactoryAdded={() => loadFactories()}
        />
      )}

      {/* Edit Factory Modal */}
      <EditFactoryModal
        isOpen={Boolean(editingFactory)}
        onClose={() => setEditingFactory(null)}
        factory={editingFactory}
        onFactoryUpdated={() => loadFactories()}
      />

      {/* Pay Factory Modal */}
      {businessId && payingFactory && (
        <PayFactoryModal
          isOpen={Boolean(payingFactory)}
          onClose={() => setPayingFactory(null)}
          factoryId={payingFactory.id}
          factoryName={payingFactory.name}
          businessId={businessId}
          onPaymentSaved={() => loadFactories()}
        />
      )}
    </div>
  )
}
