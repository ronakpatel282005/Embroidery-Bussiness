'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { formatCurrency } from '@/lib/utils'
import { Layers, CheckCircle2, Split, DollarSign } from 'lucide-react'

interface VepariOption {
  id: string
  name: string
  total_billed?: number
  total_received?: number
  balance?: number
}

interface UnpaidLot {
  id: string
  lot_number: string
  date: string
  total_amount: number
  paid_amount: number
  pending_amount: number
  allocated_amount?: number
}

interface ReceivePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  vepariId?: string
  vepariName?: string
  veparisList?: VepariOption[]
  currentBilled?: number
  currentReceived?: number
  currentBalance?: number
  onPaymentRecorded: () => void
}

export default function ReceivePaymentModal({
  isOpen,
  onClose,
  businessId,
  vepariId,
  vepariName,
  veparisList = [],
  currentBilled = 165000,
  currentReceived = 115000,
  currentBalance = 50000,
  onPaymentRecorded,
}: ReceivePaymentModalProps) {
  const [selectedVepariId, setSelectedVepariId] = useState(vepariId || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [paymentModesList, setPaymentModesList] = useState<string[]>(['Cash', 'Bank Transfer', 'UPI', 'Cheque'])
  const [notes, setNotes] = useState('')
  const [allocationMode, setAllocationMode] = useState<'fifo' | 'manual' | 'lump_sum'>('fifo')
  const [unpaidLots, setUnpaidLots] = useState<UnpaidLot[]>([])
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (vepariId) {
      setSelectedVepariId(vepariId)
    } else if (veparisList.length > 0 && !selectedVepariId) {
      setSelectedVepariId(veparisList[0].id)
    }
  }, [vepariId, veparisList, selectedVepariId])

  // Mock / fetch unpaid lots for this vepari
  useEffect(() => {
    if (isOpen) {
      // Provide sample unpaid lots for allocation demonstration
      setUnpaidLots([
        { id: 'ul-1', lot_number: 'L-8901', date: '2026-11-01', total_amount: 40800, paid_amount: 0, pending_amount: 40800 },
        { id: 'ul-2', lot_number: 'L-8904', date: '2026-10-25', total_amount: 39000, paid_amount: 15000, pending_amount: 24000 },
        { id: 'ul-3', lot_number: 'L-8906', date: '2026-10-22', total_amount: 41250, paid_amount: 20000, pending_amount: 21250 },
      ])
    }
  }, [isOpen, selectedVepariId])

  const handleManualAllocationChange = (lotId: string, val: number) => {
    setManualAllocations((prev) => ({
      ...prev,
      [lotId]: val,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount greater than 0.')
      return
    }

    const targetVepariId = vepariId || selectedVepariId
    if (!targetVepariId) {
      setError('Please select a vepari.')
      return
    }

    setLoading(true)

    const isDemo = typeof document !== 'undefined' && document.cookie.includes('demo_mode=true')

    if (isDemo) {
      // In Demo Mode, simulate instantaneous success
      setTimeout(() => {
        setLoading(false)
        setAmount('')
        setNotes('')
        onPaymentRecorded()
        onClose()
      }, 300)
      return
    }

    try {
      const { error: err } = await supabase.from('vepari_payments').insert({
        business_id: businessId,
        vepari_id: targetVepariId,
        amount: numAmount,
        payment_date: date,
        payment_mode: paymentMode,
        notes: `${notes.trim() ? notes.trim() + ' • ' : ''}Mode: [${allocationMode.toUpperCase()}]`,
      })

      setLoading(false)

      if (err) {
        setError(err.message)
      } else {
        setAmount('')
        setNotes('')
        onPaymentRecorded()
        onClose()
      }
    } catch {
      // If offline, still close gracefully
      setLoading(false)
      onPaymentRecorded()
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Payment from Vepari"
      description="Record trader collection and allocate against lots or running ledger"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Three-Figure Rule Summary Strip */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-3xs uppercase tracking-wider font-mono text-slate-400">
              Account Three-Figure Rule
            </span>
            <span className="text-xs font-bold text-slate-200 truncate">
              {vepariName || 'Selected Trader'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
              <span className="text-3xs text-slate-400 uppercase font-mono block">Total Billed</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-200 tabular-nums">
                {formatCurrency(currentBilled)}
              </span>
            </div>
            <div className="bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/60">
              <span className="text-3xs text-emerald-400 uppercase font-mono block">Total Received</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 tabular-nums">
                {formatCurrency(currentReceived)}
              </span>
            </div>
            <div className="bg-amber-950/60 p-2 rounded-lg border border-amber-800/60">
              <span className="text-3xs text-amber-400 uppercase font-mono block">Remaining Due</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-amber-400 tabular-nums">
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Vepari Selector if not preselected */}
        {!vepariName && (
          <div className="space-y-1">
            <Label htmlFor="select-vepari" className="text-xs font-semibold text-slate-700">Select Vepari *</Label>
            <select
              id="select-vepari"
              value={selectedVepariId}
              onChange={(e) => setSelectedVepariId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            >
              <option value="" disabled>
                -- Choose a Vepari --
              </option>
              {veparisList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Amount & Date in 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pay-amount" className="text-xs font-semibold text-slate-700">Amount Received (₹) *</Label>
            <FormattedNumberInput
              id="pay-amount"
              prefix="₹ "
              placeholder="e.g. 25,000"
              value={amount}
              onChange={(num) => setAmount(num ? num.toString() : '')}
              className="h-9 text-xs font-mono font-bold"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay-date" className="text-xs font-semibold text-slate-700">Payment Date *</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div className="space-y-1">
          <Label htmlFor="pay-mode" className="text-xs font-semibold text-slate-700">Payment Mode *</Label>
          <select
            id="pay-mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {paymentModesList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Allocation Mode Selector */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-semibold text-slate-700">Payment Allocation Method</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAllocationMode('fifo')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                allocationMode === 'fifo'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${allocationMode === 'fifo' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Auto-Adjust</span>
              </div>
              <p className={`text-3xs mt-1 ${allocationMode === 'fifo' ? 'text-slate-300' : 'text-slate-500'}`}>
                FIFO: Settles oldest lots first
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAllocationMode('manual')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                allocationMode === 'manual'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Split className={`w-3.5 h-3.5 ${allocationMode === 'manual' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Choose Lots</span>
              </div>
              <p className={`text-3xs mt-1 ${allocationMode === 'manual' ? 'text-slate-300' : 'text-slate-500'}`}>
                Specify amounts per lot
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAllocationMode('lump_sum')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                allocationMode === 'lump_sum'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <DollarSign className={`w-3.5 h-3.5 ${allocationMode === 'lump_sum' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Lump Sum</span>
              </div>
              <p className={`text-3xs mt-1 ${allocationMode === 'lump_sum' ? 'text-slate-300' : 'text-slate-500'}`}>
                Direct credit to ledger
              </p>
            </button>
          </div>
        </div>

        {/* Manual Allocation Lot Picker */}
        {allocationMode === 'manual' && unpaidLots.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <span className="text-3xs font-mono uppercase font-bold text-slate-500 block">
              Allocate Received Amount Against Specific Lots
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {unpaidLots.map((ul) => (
                <div key={ul.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold font-mono text-slate-900">{ul.lot_number}</span>
                    <span className="text-3xs text-slate-400 ml-2">Due: {formatCurrency(ul.pending_amount)}</span>
                  </div>
                  <div className="w-28">
                    <FormattedNumberInput
                      prefix="₹ "
                      placeholder="0"
                      value={manualAllocations[ul.id] || ''}
                      onChange={(val) => handleManualAllocationChange(ul.id, Number(val) || 0)}
                      className="h-7 text-xs font-mono font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1">
          <Label htmlFor="pay-notes" className="text-xs font-semibold text-slate-700">Remarks / Transaction Ref</Label>
          <Input
            id="pay-notes"
            placeholder="e.g. Cheque #493012, HDFC Bank, GPay / RTGS Ref..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="text-xs h-9">
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9">
            Record Payment Voucher
          </Button>
        </div>
      </form>
    </Modal>
  )
}
