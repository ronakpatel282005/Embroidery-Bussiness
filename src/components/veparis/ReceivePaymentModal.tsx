'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'

interface VepariOption {
  id: string
  name: string
}

interface ReceivePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  vepariId?: string
  vepariName?: string
  veparisList?: VepariOption[]
  onPaymentRecorded: () => void
}

export default function ReceivePaymentModal({
  isOpen,
  onClose,
  businessId,
  vepariId,
  vepariName,
  veparisList = [],
  onPaymentRecorded,
}: ReceivePaymentModalProps) {
  const [selectedVepariId, setSelectedVepariId] = useState(vepariId || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [paymentModesList, setPaymentModesList] = useState<string[]>(['Cash', 'Bank Transfer', 'UPI', 'Cheque'])
  const [notes, setNotes] = useState('')
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

  // Load custom payment modes from Master Settings
  useEffect(() => {
    if (businessId && isOpen) {
      const loadModes = async () => {
        const { data } = await supabase
          .from('payment_modes')
          .select('name')
          .eq('business_id', businessId)
          .order('name', { ascending: true })

        if (data && data.length > 0) {
          setPaymentModesList(data.map((d) => d.name))
        }
      }
      loadModes()
    }
  }, [businessId, isOpen, supabase])

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
    const { error: err } = await supabase.from('vepari_payments').insert({
      business_id: businessId,
      vepari_id: targetVepariId,
      amount: numAmount,
      payment_date: date,
      payment_mode: paymentMode,
      notes: notes.trim() || null,
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
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Payment from Vepari"
      description="Record money received from a trader to credit their ledger balance"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {/* Vepari Selector */}
        {vepariName ? (
          <div className="space-y-1">
            <Label>Vepari (Trader)</Label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-semibold text-gray-800">
              {vepariName}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="select-vepari">Select Vepari *</Label>
            <select
              id="select-vepari"
              value={selectedVepariId}
              onChange={(e) => setSelectedVepariId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="pay-amount">Amount Received (₹) *</Label>
            <FormattedNumberInput
              id="pay-amount"
              prefix="₹"
              placeholder="e.g. 25,000"
              value={amount}
              onChange={(num) => setAmount(num ? num.toString() : '')}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay-date">Payment Date *</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div className="space-y-1">
          <Label htmlFor="pay-mode">Payment Mode *</Label>
          <select
            id="pay-mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {paymentModesList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label htmlFor="pay-notes">Notes / Reference (Optional)</Label>
          <Input
            id="pay-notes"
            placeholder="e.g. Cheque No. 493012, HDFC Bank, GPay Ref #..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  )
}
