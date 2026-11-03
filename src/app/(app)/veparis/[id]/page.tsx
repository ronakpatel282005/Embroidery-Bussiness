'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import ReceivePaymentModal from '@/components/veparis/ReceivePaymentModal'
import EditVepariModal from '@/components/veparis/EditVepariModal'
import EditPaymentModal, { VepariPaymentItem } from '@/components/veparis/EditPaymentModal'
import {
  ArrowLeft,
  Receipt,
  PackagePlus,
  MessageCircle,
  Phone,
  MapPin,
  FileSpreadsheet,
  Edit2,
  Trash2,
} from 'lucide-react'

interface VepariDetails {
  id: string
  name: string
  phone: string | null
  address: string | null
  opening_balance: number
  created_at: string
}

interface PaymentRecord {
  id: string
  amount: number
  payment_date: string
  payment_mode: string
  notes: string | null
  created_at: string
}

interface LedgerEntry {
  id: string
  date: string
  type: 'opening' | 'lot' | 'payment'
  description: string
  debit: number // Money owed to us
  credit: number // Money received by us
  balance: number // Running balance
  raw: any
}

interface VepariLotSummary {
  id: string
  lot_number: string
  date: string
  total_amount: number
  total_pieces: number
  status: string
}

export default function VepariDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const vepariId = resolvedParams.id
  const router = useRouter()

  const [vepari, setVepari] = useState<VepariDetails | null>(null)
  const [lots, setLots] = useState<VepariLotSummary[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<VepariPaymentItem | null>(null)
  const [activeTab, setActiveTab] = useState<'ledger' | 'lots' | 'payments'>('ledger')

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
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

    // 1. Fetch vepari
    const { data: vData, error: vErr } = await supabase
      .from('veparis')
      .select('*')
      .eq('id', vepariId)
      .eq('business_id', business.id)
      .single()

    if (vErr || !vData) {
      setLoading(false)
      return
    }

    setVepari(vData)

    // 2. Fetch lots for this vepari
    const { data: lotsData } = await supabase
      .from('lots')
      .select(`
        id, lot_number, date, total_amount, total_pieces, status, origin_allotment_id,
        lot_items (id, work_type_name, pieces),
        origin_allotment:lot_allotments!origin_allotment_id (
          id, rate_per_piece, total_amount,
          allotment_items (pieces, work_type_name, rate, amount)
        )
      `)
      .eq('vepari_id', vepariId)
      .eq('business_id', business.id)
      .order('date', { ascending: true })

    const lotsList: VepariLotSummary[] = (lotsData || []).map((l: any) => {
      const originPieces = (l.origin_allotment?.allotment_items || []).reduce(
        (max: number, ai: any) => Math.max(max, ai.pieces || 0),
        0
      )
      const maxPartPieces = (l.lot_items || []).reduce((max: number, it: any) => Math.max(max, it.pieces || 0), 0)
      const truePieces = l.origin_allotment_id
        ? (originPieces || (maxPartPieces !== 240 && maxPartPieces > 0 ? maxPartPieces : 0) || l.total_pieces || 0)
        : (l.total_pieces || maxPartPieces || 0)

      if (l.origin_allotment_id && originPieces > 0 && l.total_pieces !== originPieces) {
        // Self-heal DB record so total_pieces is permanently accurate (e.g. 40 pcs not 240 pcs)
        supabase.from('lots').update({ total_pieces: originPieces }).eq('id', l.id).then()
      }

      return {
        id: l.id,
        lot_number: l.lot_number,
        date: l.date,
        total_amount: Number(l.total_amount) || 0,
        total_pieces: truePieces,
        status: l.status,
      }
    })
    setLots(lotsList)

    // 3. Fetch payments for this vepari
    const { data: payData } = await supabase
      .from('vepari_payments')
      .select('*')
      .eq('vepari_id', vepariId)
      .eq('business_id', business.id)
      .order('payment_date', { ascending: true })

    const paymentsList = payData || []
    setPayments(paymentsList)

    // 4. Build Ledger Entries in Chronological Order
    const entries: LedgerEntry[] = []

    // Opening balance entry
    const openingBal = Number(vData.opening_balance) || 0
    if (openingBal > 0) {
      entries.push({
        id: 'opening',
        date: vData.created_at,
        type: 'opening',
        description: 'Opening Balance (Forwarded)',
        debit: openingBal,
        credit: 0,
        balance: 0,
        raw: null,
      })
    }

    // Lots entries (Debit - owed to us)
    lotsList.forEach((l) => {
      entries.push({
        id: l.id,
        date: l.date,
        type: 'lot',
        description: `Lot Entry #${l.lot_number} (${l.total_pieces} pcs)`,
        debit: l.total_amount,
        credit: 0,
        balance: 0,
        raw: l,
      })
    })

    // Payments entries (Credit - received by us)
    paymentsList.forEach((p) => {
      const amt = Number(p.amount)
      entries.push({
        id: p.id,
        date: p.payment_date,
        type: 'payment',
        description: `Payment Received (${p.payment_mode}${p.notes ? ' - ' + p.notes : ''})`,
        debit: 0,
        credit: amt,
        balance: 0,
        raw: p,
      })
    })

    // Sort all entries by date ascending
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Recalculate running balance after full sort
    let currentBal = 0
    const calculated = entries.map((e) => {
      currentBal += e.debit - e.credit
      return { ...e, balance: currentBal }
    })

    setLedger(calculated)
    setLoading(false)
  }, [router, supabase, vepariId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeleteVepari = async () => {
    if (!vepari) return
    const confirmed = window.confirm(
      `Are you sure you want to delete ${vepari.name}?\n\nThis will permanently delete this vepari and their payment records.`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('veparis').delete().eq('id', vepari.id)
    if (delErr) {
      alert(`Cannot delete vepari: ${delErr.message}`)
    } else {
      router.push('/veparis')
    }
  }

  const handleDeletePayment = async (p: PaymentRecord) => {
    const confirmed = window.confirm(
      `Delete payment of ${formatCurrency(p.amount)} recorded on ${formatDate(p.payment_date)}?`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('vepari_payments').delete().eq('id', p.id)
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

  if (!vepari) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-800">Vepari not found</h2>
        <Link href="/veparis" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Back to Veparis list
        </Link>
      </div>
    )
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalBilled = (Number(vepari.opening_balance) || 0) + lots.reduce((sum, l) => sum + l.total_amount, 0)
  const currentBalance = totalBilled - totalPaid

  const generateWhatsAppMessage = () => {
    if (!vepari.phone) return ''
    const cleanPhone = vepari.phone.replace(/[^0-9]/g, '')
    const msg = encodeURIComponent(
      `Hello ${vepari.name},\nThis is the account summary for your embroidery work.\nTotal Payments Made: ${formatCurrency(
        totalPaid
      )}\nCurrent Balance Due: ${formatCurrency(
        currentBalance
      )}.\nPlease verify your statement and contact us for any discrepancies.`
    )
    return `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${msg}`
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/veparis"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Veparis
        </Link>
      </div>

      {/* Header Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{vepari.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                Trader Ledger
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
              {vepari.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{vepari.phone}</span>
                </div>
              )}
              {vepari.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{vepari.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="text-gray-700"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Edit Details
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteVepari}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>

            {vepari.phone && (
              <a
                href={generateWhatsAppMessage()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 px-3 text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                WhatsApp
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
              className="border-green-300 text-green-700 hover:bg-green-50 h-9"
            >
              <Receipt className="w-4 h-4 mr-1.5" />
              Receive Payment
            </Button>

            <Link href={`/lots/new?vepariId=${vepari.id}`}>
              <Button size="sm" className="h-9">
                <PackagePlus className="w-4 h-4 mr-1.5" />
                Add Lot
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Total Billed (Lots + Opening)
          </p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {formatCurrency(totalBilled)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {lots.length} lots ({formatCurrency(lots.reduce((sum, l) => sum + l.total_amount, 0))}) + {formatCurrency(vepari.opening_balance)} opening
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Total Payments Received
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{payments.length} payments recorded</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Current Outstanding Due
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              currentBalance > 0
                ? 'text-amber-600'
                : currentBalance < 0
                ? 'text-blue-600'
                : 'text-green-600'
            }`}
          >
            {formatCurrency(currentBalance)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentBalance > 0
              ? 'Pending to collect from vepari'
              : currentBalance < 0
              ? 'Advance payment with us'
              : 'Account fully settled'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Full Ledger Statement ({ledger.length})
        </button>

        <button
          onClick={() => setActiveTab('lots')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'lots'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          Lots by this Vepari ({lots.length})
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
          Payments History ({payments.length})
        </button>
      </div>

      {/* TAB 1: LEDGER STATEMENT */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {ledger.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No transactions recorded yet for this vepari.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Particulars / Description</th>
                    <th className="px-6 py-3.5 text-right">Debit (Owed)</th>
                    <th className="px-6 py-3.5 text-right">Credit (Received)</th>
                    <th className="px-6 py-3.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono text-xs">
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/75 transition-colors font-sans">
                      <td className="px-6 py-3.5 whitespace-nowrap text-gray-500 text-xs">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-medium text-gray-900 text-sm">{entry.description}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-gray-800">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-green-600 font-semibold">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
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

      {/* TAB 2: LOTS BY THIS VEPARI */}
      {activeTab === 'lots' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {lots.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <PackagePlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No lots recorded from this vepari yet.
              <div className="mt-3">
                <Link href={`/lots/new?vepariId=${vepari.id}`}>
                  <Button size="sm">
                    <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
                    Add First Lot
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Lot / Challan #</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5 text-right">Total Pieces</th>
                    <th className="px-6 py-3.5 text-right">Total Amount (₹)</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lots.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-indigo-600">
                        <Link href={`/lots/${l.id}`} className="hover:underline">
                          {l.lot_number}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 text-xs">{formatDate(l.date)}</td>
                      <td className="px-6 py-3.5 text-right font-medium text-gray-800">
                        {l.total_pieces} pcs
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(l.total_amount)}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            l.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : l.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {l.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <Link href={`/lots/${l.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                            View Lot →
                          </Button>
                        </Link>
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
              No payments recorded yet from this vepari.
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
                      <td className="px-6 py-3.5 text-gray-500 text-xs">{formatDate(p.payment_date)}</td>
                      <td className="px-6 py-3.5 font-bold text-green-600 font-mono text-sm">
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

      {/* Edit Vepari Modal */}
      <EditVepariModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        vepari={vepari}
        onVepariUpdated={() => loadData()}
      />

      {/* Receive Payment Modal */}
      {businessId && vepari && (
        <ReceivePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          businessId={businessId}
          vepariId={vepari.id}
          vepariName={vepari.name}
          onPaymentRecorded={() => loadData()}
        />
      )}

      {/* Edit Payment Modal */}
      <EditPaymentModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        vepariName={vepari?.name || 'Vepari'}
        onPaymentUpdated={() => loadData()}
      />
    </div>
  )
}
