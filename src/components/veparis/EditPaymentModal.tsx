'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { AlertCircle } from 'lucide-react'

export interface VepariPaymentItem {
  id: string
  amount: number
  payment_date: string
  payment_mode: string
  notes: string | null
}

interface EditPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  payment: VepariPaymentItem | null
  vepariName: string
  onPaymentUpdated: () => void
}

export default function EditPaymentModal({
  isOpen,
  onClose,
  payment,
  vepariName,
  onPaymentUpdated,
}: EditPaymentModalProps) {
  const [amount, setAmount] = useState<number | string>('')
  const [date, setDate] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount)
      setDate(payment.payment_date)
      setPaymentMode(payment.payment_mode || 'Cash')
      setNotes(payment.notes || '')
      setError(null)
    }
  }, [payment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return
    setError(null)

    const numAmount = Number(amount) || 0
    if (numAmount <= 0) {
      setError('Please enter a valid payment amount greater than 0.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase
      .from('vepari_payments')
      .update({
        amount: numAmount,
        payment_date: date,
        payment_mode: paymentMode,
        notes: notes.trim() || null,
      })
      .eq('id', payment.id)

    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      onPaymentUpdated()
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Payment (${vepariName})`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="edit-payment-amount">Payment Amount (₹) *</Label>
          <FormattedNumberInput
            id="edit-payment-amount"
            value={amount}
            onChange={(val) => setAmount(val || '')}
            prefix="₹"
            placeholder="e.g. 25,000"
            className="text-lg font-bold"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-payment-date">Date Received *</Label>
            <Input
              id="edit-payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-payment-mode">Payment Mode *</Label>
            <select
              id="edit-payment-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="UPI">UPI / GPay / PhonePe</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="edit-payment-notes">Notes / Reference (Optional)</Label>
          <Input
            id="edit-payment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Cheque #492812 or UTR number"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} className="bg-indigo-600 hover:bg-indigo-700">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
