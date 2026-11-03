'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import FormattedNumberInput from '@/components/ui/formatted-number-input'

interface AddVepariModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  onVepariAdded: (newVepari: { id: string; name: string }) => void
}

export default function AddVepariModal({
  isOpen,
  onClose,
  businessId,
  onVepariAdded,
}: AddVepariModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Vepari name is required.')
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('veparis')
      .insert({
        business_id: businessId,
        name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        opening_balance: parseFloat(openingBalance) || 0,
      })
      .select('id, name')
      .single()

    setLoading(false)

    if (err) {
      setError(err.message)
    } else if (data) {
      onVepariAdded(data)
      setName('')
      setPhone('')
      setAddress('')
      setOpeningBalance('')
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Vepari (Trader)"
      description="Add a trader who gives you embroidery lots"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="vepari-name">Vepari Name *</Label>
          <Input
            id="vepari-name"
            placeholder="e.g. Ramesh Bhai (Surat Fashions)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vepari-phone">Phone / WhatsApp Number</Label>
          <Input
            id="vepari-phone"
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-gray-400">Used for click-to-send WhatsApp payment reminders</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vepari-address">Shop / Market Address</Label>
          <Textarea
            id="vepari-address"
            placeholder="e.g. Shop 102, Millennium Textile Market, Ring Road"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="vepari-balance">Previous Opening Balance (₹)</Label>
          <FormattedNumberInput
            id="vepari-balance"
            prefix="₹"
            placeholder="0"
            value={openingBalance}
            onChange={(num) => setOpeningBalance(num ? num.toString() : '')}
          />
          <p className="text-xs text-gray-400">
            Any pending amount this vepari already owes you before using this software
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Save Vepari
          </Button>
        </div>
      </form>
    </Modal>
  )
}
