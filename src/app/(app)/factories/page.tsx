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
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FactoryIcon className="w-6 h-6 text-indigo-600" />
            Factories & Production Units
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your in-house machines, linked partner factories, and outside production units.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Factory
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Outstanding Payable
          </p>
          <p className="text-2xl font-bold mt-1 text-orange-600 font-mono">
            {formatCurrency(totalPayable)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Pending to pay partner factories</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Payments Made
          </p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 font-mono">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Recorded outbound payments</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Production Units
          </p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">
            {factories.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {factories.filter((f) => !f.is_own).length} Partner Units &bull; {factories.filter((f) => f.is_own).length} In-House Floor
          </p>
        </div>
      </div>

      {/* Factories Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by factory name, owner, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 whitespace-nowrap">
            Showing {filtered.length} of {factories.length} factories
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading factories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <FactoryIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No Factories Found</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'No factories match your search query.'
                : 'Click below to add your first external embroidery factory.'}
            </p>
            {!search && (
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add New Factory
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">Factory Name</th>
                  <th className="px-6 py-3.5">Connection Type</th>
                  <th className="px-6 py-3.5">Contact Person</th>
                  <th className="px-6 py-3.5">Mobile / WhatsApp</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/75 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-base">{f.is_own ? '🏠' : f.linked_business_id ? '🟢' : '⚪'}</span>
                      <span>{f.name}</span>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4">
                      {f.is_own ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                          In-House Unit (Own)
                        </span>
                      ) : f.linked_business_id ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          🟢 Linked Platform User
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          Offline Factory (WhatsApp)
                        </span>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="px-6 py-4 text-gray-700">
                      {f.owner_name || <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Contact & WhatsApp */}
                    <td className="px-6 py-4">
                      {f.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-800">{f.phone}</span>
                          <a
                            href={`https://wa.me/${f.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link href={`/factories/${f.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                            Ledger
                          </Button>
                        </Link>
                        {!f.is_own && (
                          <Button
                            size="sm"
                            className="h-8 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setPayingFactory(f)}
                          >
                            + Pay
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingFactory(f)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                          title="Edit Factory"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!f.is_own && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFactory(f)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
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
