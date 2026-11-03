'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/modal'
import { cleanPhone10 } from '@/lib/autoLinker'
import {
  Link2,
  Copy,
  Check,
  Building2,
  QrCode,
  Share2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  Factory,
  Phone,
} from 'lucide-react'

interface LinkedPartner {
  id: string
  name: string
  owner_name: string | null
  phone: string | null
  partner_type: 'Factory' | 'Client'
  linked_at: string
}

export default function BusinessLinkingPage() {
  const supabase = createClient()

  const [business, setBusiness] = useState<{ id: string; name: string; owner_name: string; phone: string } | null>(null)
  const [partners, setPartners] = useState<LinkedPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Connect modal
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerType, setPartnerType] = useState<'factory' | 'vepari'>('factory')
  const [searchLoading, setSearchLoading] = useState(false)
  const [foundBusiness, setFoundBusiness] = useState<{ id: string; name: string; owner_name: string } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectSuccess, setConnectSuccess] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: bData } = await supabase
      .from('businesses')
      .select('id, name, owner_name, phone')
      .eq('user_id', user.id)
      .single()

    if (!bData) {
      setLoading(false)
      return
    }
    setBusiness(bData)

    // Load linked factories
    const { data: linkedFacs } = await supabase
      .from('factories')
      .select('id, name, owner_name, phone, linked_business_id, created_at')
      .eq('business_id', bData.id)
      .not('linked_business_id', 'is', null)

    // Load linked veparis
    const { data: linkedVeps } = await supabase
      .from('veparis')
      .select('id, name, phone, linked_business_id, created_at')
      .eq('business_id', bData.id)
      .not('linked_business_id', 'is', null)

    const list: LinkedPartner[] = []
    ;(linkedFacs || []).forEach((f) => {
      list.push({
        id: f.id,
        name: f.name,
        owner_name: f.owner_name,
        phone: f.phone,
        partner_type: 'Factory',
        linked_at: f.created_at,
      })
    })

    ;(linkedVeps || []).forEach((v) => {
      list.push({
        id: v.id,
        name: v.name,
        owner_name: null,
        phone: v.phone,
        partner_type: 'Client',
        linked_at: v.created_at,
      })
    })

    setPartners(list)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCopyLink = () => {
    if (!business) return
    const text = `Join me on Embroidery Business Platform! Let's connect our units for instant automatic challan and order delivery. My phone: ${business.phone}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Lookup partner by phone
  const handlePhoneSearch = async (val: string) => {
    setPartnerPhone(val)
    setConnectError(null)
    setFoundBusiness(null)

    const clean = cleanPhone10(val)
    if (!clean || clean.length < 10) return

    setSearchLoading(true)
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, owner_name, phone')
      .ilike('phone', `%${clean}%`)
      .limit(1)

    setSearchLoading(false)

    if (error || !data || data.length === 0) {
      setConnectError('No registered business found for this phone number. Make sure your partner has signed up on the platform.')
    } else {
      const match = data[0]
      if (business && match.id === business.id) {
        setConnectError('This is your own registered business number.')
      } else {
        setFoundBusiness(match)
      }
    }
  }

  const handleConnectPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundBusiness || !business) return

    setSearchLoading(true)
    setConnectError(null)

    try {
      if (partnerType === 'factory') {
        // Link as factory
        await supabase.from('factories').insert({
          business_id: business.id,
          name: foundBusiness.name,
          owner_name: foundBusiness.owner_name,
          phone: partnerPhone,
          is_own: false,
          linked_business_id: foundBusiness.id,
        })
      } else {
        // Link as vepari
        await supabase.from('veparis').insert({
          business_id: business.id,
          name: foundBusiness.name,
          phone: partnerPhone,
          opening_balance: 0,
          linked_business_id: foundBusiness.id,
        })
      }

      setConnectSuccess(true)
      setTimeout(() => {
        setIsConnectOpen(false)
        setConnectSuccess(false)
        setFoundBusiness(null)
        setPartnerPhone('')
        loadData()
      }, 1500)
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect.')
    } finally {
      setSearchLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-600" />
            Supply Chain & Business Linking
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Connect directly with partner factories and designer clients on the platform for real-time automatic challan sync.
          </p>
        </div>

        <Button onClick={() => setIsConnectOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-xs">
          <Link2 className="w-4 h-4 mr-1.5" />
          Link Partner Business
        </Button>
      </div>

      {/* Your Business Linking ID Card */}
      {business && (
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-2xl p-6 mb-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
                Verified Platform Business
              </span>
              <h2 className="text-2xl font-bold">{business.name}</h2>
              <p className="text-indigo-200 text-sm mt-1">Owner: {business.owner_name} &bull; Phone: {business.phone}</p>
              <p className="text-xs text-indigo-300 mt-3 max-w-lg">
                Other registered factories and designers can link to you instantly using your registered phone number ({business.phone}).
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
              <Button
                onClick={handleCopyLink}
                className="bg-white text-indigo-900 hover:bg-indigo-50 font-semibold shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Copied Invitation!' : 'Copy Partner Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* How Real-Time Handoff Works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center mb-3 text-sm">
            1
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Instant Challan Sync</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            When you allot lots to a linked partner factory, a challan is created in their account automatically. No manual re-typing.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center mb-3 text-sm">
            2
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Two-Way Status Tracking</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            When your partner marks an allotment finished on their machines, your lot status updates to completed live.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 font-bold flex items-center justify-center mb-3 text-sm">
            3
          </div>
          <h3 className="font-bold text-gray-900 text-sm">Private & Confidential</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Your client names, billing rates, and profits are strictly private and never shared with partner factories.
          </p>
        </div>
      </div>

      {/* Linked Partners Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Connected Partner Businesses ({partners.length})
            </h2>
            <p className="text-xs text-gray-500">Live linked accounts exchanging challans and orders</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading connected partners...</div>
        ) : partners.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            No linked partner businesses yet. Click &quot;Link Partner Business&quot; above to connect.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">Business Name</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Owner / Contact</th>
                  <th className="px-6 py-3.5">Connection Status</th>
                  <th className="px-6 py-3.5 text-center">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{p.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.partner_type === 'Factory'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {p.partner_type === 'Factory' ? 'Outsourced Factory' : 'Designer Client'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {p.owner_name && <p className="font-semibold text-gray-800">{p.owner_name}</p>}
                      {p.phone && <p className="text-gray-400 font-mono">{p.phone}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Synchronized
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-gray-400 font-medium">Auto-Challan Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connect Partner Modal */}
      {isConnectOpen && (
        <Modal
          isOpen={isConnectOpen}
          onClose={() => {
            setIsConnectOpen(false)
            setFoundBusiness(null)
            setConnectError(null)
            setPartnerPhone('')
          }}
          title="Connect Partner Business on Platform"
        >
          <form onSubmit={handleConnectPartner} className="space-y-4">
            <div>
              <Label htmlFor="connect-phone">Partner&apos;s Registered Phone Number *</Label>
              <Input
                id="connect-phone"
                placeholder="e.g. 9825123456"
                value={partnerPhone}
                onChange={(e) => handlePhoneSearch(e.target.value)}
                required
              />
              <p className="text-2xs text-gray-400 mt-1">
                Enter the 10-digit mobile number your partner used to register on the platform.
              </p>
            </div>

            {searchLoading && (
              <div className="p-3 bg-indigo-50 text-indigo-700 text-xs rounded-lg flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Searching platform registry...
              </div>
            )}

            {connectError && (
              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs">
                {connectError}
              </div>
            )}

            {foundBusiness && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-2xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                  ✓ Registered Business Found
                </span>
                <p className="font-bold text-gray-900 text-base">{foundBusiness.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">Owner: {foundBusiness.owner_name}</p>

                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <Label htmlFor="link-type" className="text-xs text-gray-700">Link this business as:</Label>
                  <select
                    id="link-type"
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value as 'factory' | 'vepari')}
                    className="w-full mt-1 h-9 px-3 bg-white border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="factory">Outsourced Factory (I send work to them)</option>
                    <option value="vepari">Designer Client (They send work to me)</option>
                  </select>
                </div>
              </div>
            )}

            {connectSuccess && (
              <div className="p-3 bg-emerald-600 text-white rounded-lg text-xs font-semibold text-center">
                ✓ Successfully Connected! Auto-sync is now active.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConnectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!foundBusiness || searchLoading || connectSuccess}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Connect & Link
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
