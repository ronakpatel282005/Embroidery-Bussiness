'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import PayFactoryModal from '@/components/factories/PayFactoryModal'
import EditFactoryModal from '@/components/factories/EditFactoryModal'
import EditFactoryPaymentModal, { FactoryPaymentItem } from '@/components/factories/EditPaymentModal'
import ReceiveReturnModal from '@/components/factories/ReceiveReturnModal'
import { FactoryOption } from '@/components/factories/AddFactoryModal'
import { autoLinkFactories } from '@/lib/autoLinker'
import {
  ArrowLeft,
  Factory as FactoryIcon,
  Receipt,
  MessageCircle,
  Phone,
  Edit2,
  Trash2,
  Send,
  ArrowDownLeft,
  FileSpreadsheet,
  Package,
} from 'lucide-react'

interface FactoryPayment {
  id: string
  amount: number
  payment_date: string
  payment_mode: string
  notes: string | null
}

interface AllotmentRow {
  id: string
  lot_id: string
  lot_number: string
  challan_number: string
  allotment_date: string
  expected_delivery_date: string | null
  rate_per_piece: number
  total_amount: number
  status: string
  notes: string | null
  items: {
    work_type_name: string
    pieces: number
    returned_pieces: number
  }[]
}

interface FactoryLedgerEntry {
  id: string
  date: string
  description: string
  type: 'allotment' | 'payment'
  credit: number // Work allotted (we owe factory)
  debit: number  // Payment paid (we reduce payable)
  balance: number
}

export default function FactoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const factoryId = resolvedParams.id
  const router = useRouter()
  const supabase = createClient()

  const [factory, setFactory] = useState<FactoryOption | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [allotments, setAllotments] = useState<AllotmentRow[]>([])
  const [payments, setPayments] = useState<FactoryPayment[]>([])
  const [ledger, setLedger] = useState<FactoryLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isPayOpen, setIsPayOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<FactoryPaymentItem | null>(null)
  const [returnAllotment, setReturnAllotment] = useState<AllotmentRow | null>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<'ledger' | 'allotments' | 'payments'>('ledger')

  const loadData = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
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
    setBusinessName(business.name)

    // 1. Factory Details
    const { data: facData, error: facErr } = await supabase
      .from('factories')
      .select('*')
      .eq('id', factoryId)
      .single()

    if (facErr || !facData) {
      setLoading(false)
      return
    }

    let currentFac = facData as FactoryOption
    if (!currentFac.is_own && !currentFac.linked_business_id && currentFac.phone) {
      const { factories: healed } = await autoLinkFactories(supabase, business.id, [currentFac])
      if (healed && healed.length > 0) {
        currentFac = healed[0]
      }
    }
    setFactory(currentFac)

    // 2. Allotments to this factory
    const { data: allotRows } = await supabase
      .from('lot_allotments')
      .select(`
        id, lot_id, challan_number, allotment_date, expected_delivery_date,
        rate_per_piece, total_amount, status, notes,
        lots (lot_number),
        allotment_items (work_type_name, pieces, returned_pieces)
      `)
      .eq('factory_id', factoryId)
      .order('allotment_date', { ascending: false })

    const formattedAllots: AllotmentRow[] = (allotRows || []).map((a: any) => ({
      id: a.id,
      lot_id: a.lot_id,
      lot_number: a.lots?.lot_number || 'Unknown Lot',
      challan_number: a.challan_number,
      allotment_date: a.allotment_date,
      expected_delivery_date: a.expected_delivery_date,
      rate_per_piece: Number(a.rate_per_piece) || 0,
      total_amount: Number(a.total_amount) || 0,
      status: a.status,
      notes: a.notes,
      items: (a.allotment_items || []).map((ai: any) => ({
        work_type_name: ai.work_type_name,
        pieces: Number(ai.pieces) || 0,
        returned_pieces: Number(ai.returned_pieces) || 0,
      })),
    }))
    setAllotments(formattedAllots)

    // 3. Payments made to this factory
    let formattedPayments: FactoryPayment[] = []
    try {
      const { data: payRows } = await supabase
        .from('factory_payments')
        .select('*')
        .eq('factory_id', factoryId)
        .order('payment_date', { ascending: false })

      if (payRows) {
        formattedPayments = payRows.map((p) => ({
          id: p.id,
          amount: Number(p.amount) || 0,
          payment_date: p.payment_date,
          payment_mode: p.payment_mode,
          notes: p.notes,
        }))
        setPayments(formattedPayments)
      }
    } catch (e) {
      console.warn('factory_payments table check:', e)
    }

    // 4. Build Chronological Ledger
    // Credit = Allotment work given (we owe money to factory)
    // Debit = Payment made (we paid money, reducing payable)
    const combined: Array<{
      id: string
      date: string
      description: string
      type: 'allotment' | 'payment'
      credit: number
      debit: number
    }> = []

    formattedAllots.forEach((a) => {
      combined.push({
        id: a.id,
        date: a.allotment_date,
        description: `Outward Challan #${a.challan_number} (Lot #${a.lot_number})`,
        type: 'allotment',
        credit: a.total_amount,
        debit: 0,
      })
    })

    formattedPayments.forEach((p) => {
      combined.push({
        id: p.id,
        date: p.payment_date,
        description: `Payment Paid (${p.payment_mode})${p.notes ? ` - ${p.notes}` : ''}`,
        type: 'payment',
        credit: 0,
        debit: p.amount,
      })
    })

    // Sort ascending by date for running balance
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let running = 0
    const calculatedLedger: FactoryLedgerEntry[] = combined.map((entry) => {
      running += entry.credit - entry.debit
      return {
        ...entry,
        balance: running,
      }
    })

    // Reverse for display (newest first)
    setLedger([...calculatedLedger].reverse())
    setLoading(false)
  }, [factoryId, router, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeleteFactory = async () => {
    if (!factory) return
    if (factory.is_own) {
      alert('You cannot delete your in-house factory.')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${factory.name}"?\n\nThis will permanently delete this factory and all associated records.`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('factories').delete().eq('id', factory.id)
    if (delErr) {
      alert(`Cannot delete factory: ${delErr.message}`)
    } else {
      router.push('/factories')
    }
  }

  const handleDeletePayment = async (p: FactoryPayment) => {
    const confirmed = window.confirm(
      `Delete payment of ${formatCurrency(p.amount)} recorded on ${formatDate(p.payment_date)}?`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('factory_payments').delete().eq('id', p.id)
    if (delErr) {
      alert(`Failed to delete payment: ${delErr.message}`)
    } else {
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!factory) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-800">Factory not found</h2>
        <Link href="/factories" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Back to Factories
        </Link>
      </div>
    )
  }

  // KPIs
  const totalBilled = allotments.reduce((sum, a) => sum + a.total_amount, 0)
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const currentPayable = totalBilled - totalPaid

  const totalPiecesSent = allotments.reduce((sum, a) => {
    return sum + a.items.reduce((pSum, it) => pSum + it.pieces, 0)
  }, 0)

  const totalPiecesReturned = allotments.reduce((sum, a) => {
    return sum + a.items.reduce((pSum, it) => pSum + (it.returned_pieces || 0), 0)
  }, 0)

  const generateWhatsAppStatement = () => {
    if (!factory.phone) return ''
    const msg = `*📋 ACCOUNT STATEMENT FOR ${factory.name.toUpperCase()}*
*From:* ${businessName}
*Date:* ${new Date().toLocaleDateString('en-IN')}

*Total Work Completed:* ${formatCurrency(totalBilled)}
*Total Payments Received:* ${formatCurrency(totalPaid)}
*Outstanding Balance Due:* ${formatCurrency(currentPayable)}

_Please check and contact us for any clarification._`

    const clean = factory.phone.replace(/[^0-9]/g, '')
    const target = clean.startsWith('91') ? clean : `91${clean}`
    return `https://wa.me/${target}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Back Button */}
      <div className="mb-4">
        <Link
          href="/factories"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Factories
        </Link>
      </div>

      {/* Header Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {factory.is_own ? '🏠' : factory.linked_business_id ? '🟢' : '⚪'}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{factory.name}</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  factory.is_own
                    ? 'bg-indigo-50 text-indigo-700'
                    : factory.linked_business_id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {factory.is_own
                  ? 'In-House Unit'
                  : factory.linked_business_id
                  ? 'Linked Platform App'
                  : 'Offline Factory'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
              {factory.owner_name && <span>Owner: {factory.owner_name}</span>}
              {factory.phone && (
                <div className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>{factory.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="text-gray-700"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Edit Details
            </Button>

            {!factory.is_own && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteFactory}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete
              </Button>
            )}

            {factory.phone && (
              <a
                href={generateWhatsAppStatement()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 px-3 text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                WhatsApp Statement
              </a>
            )}

            <Button
              size="sm"
              onClick={() => setIsPayOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 h-9"
            >
              <Receipt className="w-4 h-4 mr-1.5" />
              Pay Factory
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-2xs font-semibold uppercase tracking-wider text-gray-400">Total Work Sent</p>
          <p className="text-2xl font-bold text-gray-900 font-mono mt-1">
            {formatCurrency(totalBilled)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{allotments.length} outward challans</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-2xs font-semibold uppercase tracking-wider text-gray-400">Total Payments Paid</p>
          <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{payments.length} payment transactions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
            Net Payable (We Owe)
          </p>
          <p
            className={`text-2xl font-bold font-mono mt-1 ${
              currentPayable > 0 ? 'text-amber-600 font-black' : 'text-gray-900'
            }`}
          >
            {formatCurrency(currentPayable)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Outstanding balance</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-2xs font-semibold uppercase tracking-wider text-gray-400">Pieces Sent vs Returned</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totalPiecesReturned.toLocaleString('en-IN')}{' '}
            <span className="text-xs text-gray-400 font-normal">
              / {totalPiecesSent.toLocaleString('en-IN')} pcs
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalPiecesSent - totalPiecesReturned} pieces in production
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Ledger Statement ({ledger.length})
        </button>

        <button
          onClick={() => setActiveTab('allotments')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'allotments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send className="w-4 h-4" />
          Outward Allotments ({allotments.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Payments Paid ({payments.length})
        </button>
      </div>

      {/* TAB 1: LEDGER STATEMENT */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {ledger.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No transactions recorded yet for this factory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Particulars / Description</th>
                    <th className="px-6 py-3.5 text-right">Work Given (Credit)</th>
                    <th className="px-6 py-3.5 text-right">Payment Paid (Debit)</th>
                    <th className="px-6 py-3.5 text-right">Balance Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap text-gray-500 text-xs">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-medium text-gray-900 text-sm">{entry.description}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-gray-800">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-emerald-600 font-bold">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs font-bold text-gray-900">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OUTWARD ALLOTMENTS */}
      {activeTab === 'allotments' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {allotments.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No lots allotted to this factory yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Challan # & Date</th>
                    <th className="px-6 py-3.5">Lot Number</th>
                    <th className="px-6 py-3.5">Parts & Pieces Sent</th>
                    <th className="px-6 py-3.5 text-right">Rate & Amount</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allotments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900">
                        {a.challan_number}
                        <span className="block text-2xs text-gray-400 font-normal">
                          {formatDate(a.allotment_date)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <Link
                          href={`/lots/${a.lot_id}`}
                          className="font-bold text-indigo-600 hover:underline"
                        >
                          {a.lot_number}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-700">
                        {a.items.map((it, idx) => {
                          const isDone = (it.returned_pieces || 0) >= it.pieces
                          return (
                            <span key={idx} className="block">
                              • {it.work_type_name}: <b>{it.pieces} pcs</b>
                              {it.returned_pieces > 0 && (
                                <span className="text-2xs text-emerald-600 ml-1">
                                  ({it.returned_pieces} returned)
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs">
                        <span className="font-bold text-gray-900 text-sm block">
                          {formatCurrency(a.total_amount)}
                        </span>
                        <span className="text-gray-400">₹{a.rate_per_piece}/pc</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            a.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReturnAllotment(a)}
                          className="h-8 text-xs px-2.5 text-indigo-600 hover:bg-indigo-50"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                          Receive Inward
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS HISTORY */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {payments.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No payments recorded yet for this factory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Payment Date</th>
                    <th className="px-6 py-3.5">Amount (₹)</th>
                    <th className="px-6 py-3.5">Payment Mode</th>
                    <th className="px-6 py-3.5">Notes / Ref</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-3.5 text-gray-500 text-xs">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-emerald-600 font-mono text-sm">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-500">{p.notes || '—'}</td>
                      <td className="px-6 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingPayment(p)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                            title="Edit Payment"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                            title="Delete Payment"
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
      )}

      {/* Pay Factory Modal */}
      {businessId && (
        <PayFactoryModal
          isOpen={isPayOpen}
          onClose={() => setIsPayOpen(false)}
          factoryId={factory.id}
          factoryName={factory.name}
          businessId={businessId}
          onPaymentSaved={loadData}
        />
      )}

      {/* Edit Factory Modal */}
      <EditFactoryModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        factory={factory}
        onFactoryUpdated={loadData}
      />

      {/* Edit Factory Payment Modal */}
      <EditFactoryPaymentModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        factoryName={factory.name}
        onPaymentUpdated={loadData}
      />

      {/* Receive Return Modal */}
      {returnAllotment && (
        <ReceiveReturnModal
          isOpen={Boolean(returnAllotment)}
          onClose={() => setReturnAllotment(null)}
          allotmentId={returnAllotment.id}
          challanNumber={returnAllotment.challan_number}
          factoryName={factory.name}
          onReturnSaved={loadData}
        />
      )}
    </div>
  )
}
