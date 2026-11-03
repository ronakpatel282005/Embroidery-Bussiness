'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { Receipt, AlertCircle } from 'lucide-react'

interface PayFactoryModalProps {
  isOpen: boolean
  onClose: () => void
  factoryId: string
  factoryName: string
  businessId: string
  onPaymentSaved: () => void
}

export default function PayFactoryModal({
  isOpen,
  onClose,
  factoryId,
  factoryName,
  businessId,
  onPaymentSaved,
}: PayFactoryModalProps) {
  const supabase = createClient()

  const [amount, setAmount] = useState<number | string>('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = Number(amount) || 0
    if (numAmount <= 0) {
      setError('Please enter a valid payment amount.')
      return
    }

    setLoading(true)

    const { error: insErr } = await supabase.from('factory_payments').insert({
      business_id: businessId,
      factory_id: factoryId,
      amount: numAmount,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      notes: notes.trim() || null,
    })

    setLoading(false)

    if (insErr) {
      setError(insErr.message)
    } else {
      setAmount('')
      setNotes('')
      onPaymentSaved()
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pay Factory: ${factoryName}`}
      description="Record a cash, bank, or UPI payment made to this embroidery factory"
      maxWidth="md"
    >
      {error && (
        <div className="p-3 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="space-y-1">
          <Label htmlFor="pay-fac-amount">Payment Amount (₹) *</Label>
          <FormattedNumberInput
            id="pay-fac-amount"
            prefix="₹"
            placeholder="e.g. 15,000"
            value={amount}
            onChange={(val) => setAmount(val || '')}
            className="font-bold text-lg h-11"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pay-fac-date">Payment Date *</Label>
            <Input
              id="pay-fac-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay-fac-mode">Payment Mode *</Label>
            <select
              id="pay-fac-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI (Google Pay / PhonePe)</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pay-fac-notes">Reference / Cheque # / Notes (Optional)</Label>
          <Input
            id="pay-fac-notes"
            placeholder="e.g. UPI Ref #4029481, Cheque 401024"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700">
            <Receipt className="w-4 h-4 mr-1.5" />
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  )
}
