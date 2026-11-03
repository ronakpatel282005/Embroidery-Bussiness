'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Sparkles, Building2, Link2, Unlink } from 'lucide-react'
import { FactoryOption } from './AddFactoryModal'
import { cleanPhone10 } from '@/lib/autoLinker'

interface EditFactoryModalProps {
  isOpen: boolean
  onClose: () => void
  factory: FactoryOption | null
  onFactoryUpdated: () => void
}

interface DiscoveredCompany {
  id: string
  name: string
  owner_name?: string | null
  address?: string | null
}

export default function EditFactoryModal({
  isOpen,
  onClose,
  factory,
  onFactoryUpdated,
}: EditFactoryModalProps) {
  const supabase = createClient()

  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedBusinessId, setLinkedBusinessId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phone lookup states
  const [isSearchingPhone, setIsSearchingPhone] = useState(false)
  const [discoveredCompanies, setDiscoveredCompanies] = useState<DiscoveredCompany[]>([])

  useEffect(() => {
    if (factory) {
      setName(factory.name || '')
      setOwnerName(factory.owner_name || '')
      setPhone(factory.phone || '')
      setLinkedBusinessId(factory.linked_business_id || null)
      setError(null)
    }
  }, [factory])

  // Phone check on phone change
  useEffect(() => {
    const clean10 = cleanPhone10(phone)
    if (!clean10) {
      setDiscoveredCompanies([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingPhone(true)
      try {
        const { data, error: rpcErr } = await supabase.rpc('find_businesses_by_phone', {
          phone_query: clean10,
        })
        if (!rpcErr && data && Array.isArray(data)) {
          setDiscoveredCompanies(data)
        }
      } catch (e) {
        console.error('Phone lookup error:', e)
      } finally {
        setIsSearchingPhone(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [phone, supabase, linkedBusinessId])

  if (!factory) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter the factory name.')
      return
    }

    setSaving(true)

    const { error: updateErr } = await supabase
      .from('factories')
      .update({
        name: name.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        linked_business_id: linkedBusinessId || null,
      })
      .eq('id', factory.id)

    setSaving(false)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      onFactoryUpdated()
      onClose()
    }
  }

  const linkedCompanyInfo = discoveredCompanies.find((c) => c.id === linkedBusinessId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Factory: ${factory.name}`}
      description="Update factory contact details, phone, and platform account link"
      maxWidth="md"
    >
      {error && (
        <div className="p-3 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Factory Name */}
        <div className="space-y-1">
          <Label htmlFor="edit-fac-name">Factory / Unit Name *</Label>
          <Input
            id="edit-fac-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Owner Name */}
        <div className="space-y-1">
          <Label htmlFor="edit-fac-owner">Owner / Contact Person</Label>
          <Input
            id="edit-fac-owner"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-fac-phone">Mobile / WhatsApp Number</Label>
            {isSearchingPhone && (
              <span className="text-xs text-indigo-600 flex items-center gap-1 font-medium">
                <span className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                Checking platform...
              </span>
            )}
          </div>
          <Input
            id="edit-fac-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 98251 12345"
          />
        </div>

        {/* PLATFORM ACCOUNT LINKING STATUS BANNER */}
        {!factory.is_own && (
          <div className="rounded-xl p-3 border text-xs">
            {linkedBusinessId ? (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🟢</span>
                    <div>
                      <p className="font-bold">Linked Platform User</p>
                      <p className="text-2xs text-emerald-700">
                        {linkedCompanyInfo
                          ? `Connected to: ${linkedCompanyInfo.name} (${linkedCompanyInfo.owner_name || 'Owner'})`
                          : 'Connected to active platform account. Allotted lots sync automatically!'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedBusinessId(null)}
                    className="flex items-center gap-1 text-2xs font-semibold text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-1 rounded shadow-xs"
                  >
                    <Unlink className="w-3 h-3" />
                    Unlink
                  </button>
                </div>
              </div>
            ) : discoveredCompanies.length === 1 ? (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg text-emerald-950 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950">
                        Registered Account Found: {discoveredCompanies[0].name}
                      </p>
                      <p className="text-2xs text-emerald-700">
                        Owner: {discoveredCompanies[0].owner_name || '—'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedBusinessId(discoveredCompanies[0].id)
                      if (!name) setName(discoveredCompanies[0].name)
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-md shrink-0 shadow-xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link Account Now
                  </button>
                </div>
              </div>
            ) : discoveredCompanies.length > 1 ? (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg text-amber-950 space-y-2">
                <p className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Multiple accounts found with this phone number:
                </p>
                <div className="space-y-1.5 pt-1">
                  {discoveredCompanies.map((comp) => (
                    <div
                      key={comp.id}
                      onClick={() => setLinkedBusinessId(comp.id)}
                      className={`p-2 rounded border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        linkedBusinessId === comp.id
                          ? 'bg-emerald-100/70 border-emerald-500 text-emerald-950 font-bold'
                          : 'bg-white border-amber-200 hover:bg-amber-100/50 text-gray-800'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{comp.name}</p>
                        <p className="text-2xs text-gray-500">
                          {comp.owner_name ? `Owner: ${comp.owner_name}` : ''}
                        </p>
                      </div>
                      <span className="text-2xs text-indigo-600 font-semibold underline">
                        {linkedBusinessId === comp.id ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <span className="text-base">⚪</span>
                <div>
                  <p className="font-semibold text-gray-800">Offline Factory (WhatsApp)</p>
                  <p className="text-2xs text-gray-400">
                    No registered platform account found for this phone number.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
