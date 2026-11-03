'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Factory as FactoryIcon, Building2, Check, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import { cleanPhone10 } from '@/lib/autoLinker'

export interface FactoryOption {
  id: string
  name: string
  owner_name?: string | null
  phone?: string | null
  is_own: boolean
  linked_business_id?: string | null
}

interface DiscoveredCompany {
  id: string
  name: string
  owner_name: string
  address: string | null
}

interface AddFactoryModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  onFactoryAdded: (newFactory: FactoryOption) => void
}

export default function AddFactoryModal({
  isOpen,
  onClose,
  businessId,
  onFactoryAdded,
}: AddFactoryModalProps) {
  const supabase = createClient()

  // Primary first input: Phone Number
  const [phone, setPhone] = useState('')

  // Auto-filled details
  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Smart Discovery state
  const [isSearchingPhone, setIsSearchingPhone] = useState(false)
  const [discoveredCompanies, setDiscoveredCompanies] = useState<DiscoveredCompany[]>([])
  const [selectedLinkedId, setSelectedLinkedId] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setPhone('')
      setName('')
      setOwnerName('')
      setAddress('')
      setError(null)
      setDiscoveredCompanies([])
      setSelectedLinkedId(null)
      setHasSearched(false)
      setAutoFilled(false)
    }
  }, [isOpen])

  // Debounced phone lookup + Auto-fill
  useEffect(() => {
    const clean10 = cleanPhone10(phone)
    if (!clean10) {
      setDiscoveredCompanies([])
      setSelectedLinkedId(null)
      setHasSearched(false)
      setAutoFilled(false)
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
          setHasSearched(true)

          if (data.length === 1) {
            // Exactly 1 match found: AUTO-FILL EVERYTHING!
            const comp = data[0]
            setSelectedLinkedId(comp.id)
            setName(comp.name)
            setOwnerName(comp.owner_name || '')
            setAddress(comp.address || '')
            setAutoFilled(true)
          } else if (data.length > 1) {
            // Multiple companies found: auto-select first one and fill
            const comp = data[0]
            setSelectedLinkedId(comp.id)
            setName(comp.name)
            setOwnerName(comp.owner_name || '')
            setAddress(comp.address || '')
            setAutoFilled(true)
          } else {
            // No match found
            setSelectedLinkedId(null)
            setAutoFilled(false)
          }
        }
      } catch (err) {
        console.error('Phone lookup error:', err)
      } finally {
        setIsSearchingPhone(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [phone, supabase])

  const handleSelectCompany = (comp: DiscoveredCompany) => {
    setSelectedLinkedId(comp.id)
    setName(comp.name)
    setOwnerName(comp.owner_name || '')
    setAddress(comp.address || '')
    setAutoFilled(true)
  }

  const handleUnlink = () => {
    setSelectedLinkedId(null)
    setAutoFilled(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter the factory name.')
      return
    }

    setLoading(true)

    const newFactoryRecord = {
      business_id: businessId,
      name: name.trim(),
      owner_name: ownerName.trim() || null,
      phone: phone.trim() || null,
      is_own: false,
      linked_business_id: selectedLinkedId || null,
    }

    const { data, error: insertError } = await supabase
      .from('factories')
      .insert(newFactoryRecord)
      .select('id, name, owner_name, phone, is_own, linked_business_id')
      .single()

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      onFactoryAdded(data as FactoryOption)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Embroidery Factory"
      description="Enter mobile number first to automatically detect and auto-fill registered companies"
      maxWidth="lg"
    >
      {error && (
        <div className="p-3 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* FIELD 1: MOBILE / WHATSAPP NUMBER (FIRST FIELD) */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="factory-phone" className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
              <span>Mobile / WhatsApp Number *</span>
              <span className="text-2xs font-normal text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                Enter first for Auto-Fill
              </span>
            </Label>
            {isSearchingPhone && (
              <span className="text-xs text-indigo-700 flex items-center gap-1 font-semibold">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-700 border-t-transparent rounded-full" />
                Checking platform...
              </span>
            )}
          </div>
          <Input
            id="factory-phone"
            type="tel"
            placeholder="e.g. 98251 12345"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-white font-mono text-base font-semibold border-indigo-200 focus-visible:ring-indigo-600 h-11"
            autoFocus
            required
          />
          <p className="text-2xs text-indigo-700">
            As soon as you type 10 digits, the system will search for existing companies and auto-fill their details!
          </p>
        </div>

        {/* SMART DETECTION & AUTO-FILL STATUS BANNER */}
        {hasSearched && (
          <div className="rounded-xl p-3 text-xs border transition-all animate-in fade-in duration-200">
            {discoveredCompanies.length === 0 ? (
              <div className="flex items-start gap-2.5 text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                <span className="text-base leading-none">⚪</span>
                <div>
                  <p className="font-semibold text-gray-900">Offline Factory (Not registered yet)</p>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    No account found with this number. Please fill in the factory name below. You can send work challans via 1-Click WhatsApp!
                  </p>
                </div>
              </div>
            ) : discoveredCompanies.length === 1 ? (
              <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-lg text-emerald-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-emerald-950">
                          {discoveredCompanies[0].name}
                        </p>
                        <span className="text-2xs font-bold bg-emerald-200 text-emerald-900 px-2 py-0.2 rounded-full">
                          Platform User
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Owner: {discoveredCompanies[0].owner_name || '—'}
                      </p>
                      {autoFilled && (
                        <p className="text-2xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>All fields below have been automatically filled!</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-emerald-900 shrink-0 bg-emerald-100 px-2.5 py-1.5 rounded-md hover:bg-emerald-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedLinkedId === discoveredCompanies[0].id}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleSelectCompany(discoveredCompanies[0])
                        } else {
                          handleUnlink()
                        }
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Link Company</span>
                  </label>
                </div>
              </div>
            ) : (
              /* MULTIPLE COMPANIES DETECTED FOR THIS PHONE NUMBER */
              <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-lg text-amber-950 space-y-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="font-bold text-amber-950 text-xs">
                    Found {discoveredCompanies.length} companies registered with this mobile number:
                  </p>
                </div>
                <p className="text-2xs text-amber-800">
                  Click on the company you want to link — all its details will auto-fill below:
                </p>

                <div className="space-y-1.5 pt-0.5">
                  {discoveredCompanies.map((comp) => (
                    <label
                      key={comp.id}
                      onClick={() => handleSelectCompany(comp)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedLinkedId === comp.id
                          ? 'bg-amber-100 border-amber-400 font-bold text-amber-950 shadow-xs'
                          : 'bg-white border-amber-200 hover:bg-amber-50 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selectedCompany"
                          checked={selectedLinkedId === comp.id}
                          onChange={() => handleSelectCompany(comp)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-semibold text-gray-900">{comp.name}</span>
                          <span className="text-2xs text-gray-500 ml-2">
                            ({comp.owner_name})
                          </span>
                        </div>
                      </div>
                      {selectedLinkedId === comp.id && (
                        <span className="text-2xs font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Selected & Filled
                        </span>
                      )}
                    </label>
                  ))}

                  <label
                    onClick={handleUnlink}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedLinkedId === null
                        ? 'bg-gray-100 border-gray-400 font-semibold text-gray-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectedCompany"
                      checked={selectedLinkedId === null}
                      onChange={handleUnlink}
                      className="text-gray-600 focus:ring-gray-500"
                    />
                    <span>Do not link (Keep as offline factory)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FIELD 2: FACTORY NAME (AUTO-FILLED) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="factory-name">Factory / Unit Name *</Label>
            {autoFilled && (
              <span className="text-2xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Auto-filled
              </span>
            )}
          </div>
          <Input
            id="factory-name"
            placeholder="e.g. Adiyogi Unit 1 (Khatodara)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* FIELD 3: OWNER / CONTACT PERSON (AUTO-FILLED) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="owner-name">Owner / Contact Person</Label>
            {autoFilled && ownerName && (
              <span className="text-2xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Auto-filled
              </span>
            )}
          </div>
          <Input
            id="owner-name"
            placeholder="e.g. Ramesh Bhai"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>

        {/* FIELD 4: LOCATION / ADDRESS (AUTO-FILLED) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="factory-address">Location / GIDC Address</Label>
            {autoFilled && address && (
              <span className="text-2xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Auto-filled
              </span>
            )}
          </div>
          <Input
            id="factory-address"
            placeholder="e.g. Plot 42, Khatodara GIDC, Surat"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        {/* SUBMIT BUTTONS */}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={loading}
            className="bg-indigo-600 hover:bg-indigo-700 min-w-32"
          >
            Save Factory
          </Button>
        </div>
      </form>
    </Modal>
  )
}
