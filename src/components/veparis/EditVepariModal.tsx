'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import FormattedNumberInput from '@/components/ui/formatted-number-input'

export interface VepariEditData {
  id: string
  name: string
  phone: string | null
  address: string | null
  opening_balance: number
}

interface EditVepariModalProps {
  isOpen: boolean
  onClose: () => void
  vepari: VepariEditData | null
  onVepariUpdated: () => void
}

export default function EditVepariModal({
  isOpen,
  onClose,
  vepari,
  onVepariUpdated,
}: EditVepariModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (vepari) {
      setName(vepari.name || '')
      setPhone(vepari.phone || '')
      setAddress(vepari.address || '')
      setOpeningBalance(vepari.opening_balance?.toString() || '0')
    }
  }, [vepari])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vepari) return
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Vepari name is required.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase
      .from('veparis')
      .update({
        name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        opening_balance: parseFloat(openingBalance) || 0,
      })
      .eq('id', vepari.id)

    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      onVepariUpdated()
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Vepari Information"
      description="Update client name, contact numbers, address or opening balance"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="edit-vepari-name">Vepari Name *</Label>
          <Input
            id="edit-vepari-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="edit-vepari-phone">Phone / WhatsApp Number</Label>
          <Input
            id="edit-vepari-phone"
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="edit-vepari-address">Shop / Market Address</Label>
          <Textarea
            id="edit-vepari-address"
            placeholder="e.g. Shop 102, Millennium Market"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="edit-vepari-balance">Previous Opening Balance (₹)</Label>
          <FormattedNumberInput
            id="edit-vepari-balance"
            prefix="₹"
            value={openingBalance}
            onChange={(num) => setOpeningBalance(num ? num.toString() : '')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
