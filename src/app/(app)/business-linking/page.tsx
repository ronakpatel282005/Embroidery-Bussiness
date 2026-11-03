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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Network & Nodes</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-medium">B2B Integration</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Supply Chain & Business Linking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connect directly with partner factories and designer clients for real-time automated challan and lot status dispatch.
          </p>
        </div>

        <Button onClick={() => setIsConnectOpen(true)} className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs">
          <Link2 className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
          Link Partner Node
        </Button>
      </div>

      {/* Your Business Linking ID Card */}
      {business && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 text-emerald-400 border border-slate-700 rounded text-2xs font-mono font-medium uppercase tracking-wider mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Verified Production Node
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white">{business.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5 font-mono">
                <span>Principal: {business.owner_name}</span>
                <span className="text-slate-600">•</span>
                <span>Direct Node: {business.phone}</span>
              </div>
              <p className="text-xs text-slate-400 mt-3 max-w-xl leading-relaxed">
                Registered partner embroidery factories and fabric traders can pair to your account using your verified mobile identifier ({business.phone}).
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
              <Button
                onClick={handleCopyLink}
                className="h-8 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-2xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                {copied ? 'Copied Details' : 'Copy Partner Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* How Real-Time Handoff Works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-mono text-2xs font-bold flex items-center justify-center mb-2.5">
            01
          </div>
          <h3 className="font-semibold text-slate-900 text-xs">Automated Challan Sync</h3>
          <p className="text-2xs text-slate-600 mt-1 leading-relaxed">
            When you allot lots to a linked partner unit, a digital challan is created in their account automatically with zero data entry.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-mono text-2xs font-bold flex items-center justify-center mb-2.5">
            02
          </div>
          <h3 className="font-semibold text-slate-900 text-xs">Bi-Directional Telemetry</h3>
          <p className="text-2xs text-slate-600 mt-1 leading-relaxed">
            When partner shifts finish piece-counts on their embroidery machines, your floor dashboard marks the stage complete in real time.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-mono text-2xs font-bold flex items-center justify-center mb-2.5">
            03
          </div>
          <h3 className="font-semibold text-slate-900 text-xs">Zero Commercial Exposure</h3>
          <p className="text-2xs text-slate-600 mt-1 leading-relaxed">
            Trader identities, client billings, and profit margins are strictly isolated and never visible to partner factories.
          </p>
        </div>
      </div>

      {/* Linked Partners Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Connected Partner Units ({partners.length})
            </h2>
            <p className="text-2xs text-slate-600 mt-0.5">Live linked accounts exchanging challans and orders</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="animate-spin h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full mx-auto mb-2" />
            Scanning network nodes...
          </div>
        ) : partners.length === 0 ? (
          <div className="py-16 text-center text-slate-600 text-xs font-mono">
            <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            No linked partner businesses yet. Click &quot;Link Partner Node&quot; above to connect.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-2xs uppercase font-bold text-slate-600 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Business Entity</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Principal / Contact</th>
                  <th className="px-5 py-3">Handshake Status</th>
                  <th className="px-5 py-3 text-center">Sync Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {p.partner_type === 'Factory' ? 'Outsourced Factory' : 'Designer Client'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {p.owner_name && <p className="font-semibold text-slate-800">{p.owner_name}</p>}
                      {p.phone && <p className="text-slate-600 font-mono text-2xs">{p.phone}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-2xs text-emerald-700 font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Synchronized
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-2xs text-slate-600 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">Active</span>
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
              <p className="text-2xs text-slate-600 mt-1">
                Enter the 10-digit mobile number your partner used to register on the platform.
              </p>
            </div>

            {searchLoading && (
              <div className="p-3 bg-slate-50 text-slate-700 text-xs rounded-lg flex items-center gap-2 border border-slate-200">
                <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                Querying platform directory...
              </div>
            )}

            {connectError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs">
                {connectError}
              </div>
            )}

            {foundBusiness && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-2xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                  ✓ Registered Business Node Found
                </span>
                <p className="font-bold text-slate-900 text-sm">{foundBusiness.name}</p>
                <p className="text-xs text-slate-600 mt-0.5">Principal: {foundBusiness.owner_name}</p>

                <div className="mt-3 pt-3 border-t border-slate-200">
                  <Label htmlFor="link-type" className="text-xs text-slate-700">Link relationship:</Label>
                  <select
                    id="link-type"
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value as 'factory' | 'vepari')}
                    className="w-full mt-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="factory">Outsourced Factory (Job Work Unit)</option>
                    <option value="vepari">Designer Client (Vepari / Merchant)</option>
                  </select>
                </div>
              </div>
            )}

            {connectSuccess && (
              <div className="p-3 bg-emerald-700 text-white rounded-lg text-xs font-semibold text-center">
                ✓ Node Successfully Linked! Live auto-challan dispatch is enabled.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConnectOpen(false)}
                className="h-8 text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!foundBusiness || searchLoading || connectSuccess}
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              >
                Establish Link
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
