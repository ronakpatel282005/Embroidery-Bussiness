'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import AddFactoryModal, { FactoryOption } from '@/components/factories/AddFactoryModal'
import { autoLinkFactories } from '@/lib/autoLinker'
import {
  ArrowLeft,
  Send,
  Plus,
  Factory as FactoryIcon,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface LotItem {
  id: string
  work_type_name: string
  pieces: number
  allotted_pieces: number
  available_pieces: number
}

interface LotDetail {
  id: string
  business_id: string
  lot_number: string
  date: string
  due_date: string | null
  design_number: string | null
  description: string | null
  pricing_type: string
  total_pieces: number
  total_amount: number
  vepari_name: string
  items: LotItem[]
  allotted_pieces: number
  available_pieces: number
}

export default function LotAllotmentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const lotId = resolvedParams.id
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [lot, setLot] = useState<LotDetail | null>(null)
  const [businessName, setBusinessName] = useState<string>('')
  const [factories, setFactories] = useState<FactoryOption[]>([])
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [isAddFactoryOpen, setIsAddFactoryOpen] = useState(false)

  // Quantity to allot (supports split lots: e.g. 200 to factory 1, 40 to factory 2)
  const [piecesToAllot, setPiecesToAllot] = useState<number | ''>('')

  // Allotment form fields
  const [challanNumber, setChallanNumber] = useState('')
  const [allotmentDate, setAllotmentDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  // Factory pricing
  const [pricingType, setPricingType] = useState<'per_piece' | 'full_lot'>('per_piece')
  const [ratePerPiece, setRatePerPiece] = useState<number | string>('')
  const [fullLotPrice, setFullLotPrice] = useState<number | string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Lot, Items & Factories
  const loadData = useCallback(async () => {
    setLoading(true)

    // 1. Current business
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      router.push('/dashboard')
      return
    }
    setBusinessName(business.name)

    // 2. Lot details with vepari
    const { data: lotData, error: lotErr } = await supabase
      .from('lots')
      .select(`
        *,
        veparis(name),
        origin_allotment:lot_allotments!origin_allotment_id (
          id, rate_per_piece, total_amount,
          allotment_items (pieces, work_type_name, rate, amount)
        )
      `)
      .eq('id', lotId)
      .eq('business_id', business.id)
      .single()

    if (lotErr || !lotData) {
      setError('Lot not found.')
      setLoading(false)
      return
    }

    // 3. Lot items (parts in this lot)
    const { data: itemsData } = await supabase
      .from('lot_items')
      .select('*')
      .eq('lot_id', lotId)

    const originPieces = (lotData.origin_allotment?.allotment_items || []).reduce(
      (max: number, ai: any) => Math.max(max, ai.pieces || 0),
      0
    )

    const items: LotItem[] = (itemsData || []).map((i) => {
      const truePieces = lotData.origin_allotment_id && originPieces > 0 ? originPieces : i.pieces
      const allotted = i.allotted_pieces || 0
      const available = Math.max(0, truePieces - allotted)
      return {
        id: i.id,
        work_type_name: i.work_type_name,
        pieces: truePieces,
        allotted_pieces: allotted,
        available_pieces: available,
      }
    })

    const maxPartPieces = items.reduce((max, it) => Math.max(max, it.pieces || 0), 0)
    const isSummedPieces =
      items.length > 1 &&
      maxPartPieces > 0 &&
      lotData.total_pieces === items.reduce((sum, it) => sum + (it.pieces || 0), 0)

    // For incoming partner jobs (e.g. 40 pcs allotted to Shree Krishna), total lot size is 40 pcs, NOT parent's 240!
    const totalLotPieces = lotData.origin_allotment_id
      ? (originPieces || (maxPartPieces !== 240 && maxPartPieces > 0 ? maxPartPieces : 0) || lotData.total_pieces || 0)
      : (isSummedPieces ? maxPartPieces : (lotData.total_pieces || maxPartPieces || 0))

    if (lotData.origin_allotment_id && originPieces > 0 && lotData.total_pieces !== originPieces) {
      supabase.from('lots').update({ total_pieces: originPieces }).eq('id', lotData.id).then()
      if (itemsData && itemsData.length > 0) {
        itemsData.forEach((it: any) => {
          if (it.pieces !== originPieces) {
            supabase.from('lot_items').update({ pieces: originPieces }).eq('id', it.id).then()
          }
        })
      }
    }

    const maxAllotted = items.reduce((max, it) => Math.max(max, it.allotted_pieces), 0)
    const availablePieces = Math.max(0, totalLotPieces - maxAllotted)

    setLot({
      id: lotData.id,
      business_id: lotData.business_id,
      lot_number: lotData.lot_number,
      date: lotData.date,
      due_date: lotData.due_date,
      design_number: lotData.design_number,
      description: lotData.description,
      pricing_type: lotData.pricing_type,
      total_pieces: totalLotPieces,
      total_amount: Number(lotData.total_amount) || 0,
      vepari_name: (lotData.veparis as any)?.name || 'Unknown Vepari',
      items,
      allotted_pieces: maxAllotted,
      available_pieces: availablePieces,
    })

    // Pre-fill quantity to allot with remaining available pieces
    setPiecesToAllot(availablePieces)

    // Check existing allotments count to suggest clean challan number
    const { count } = await supabase
      .from('lot_allotments')
      .select('id', { count: 'exact', head: true })
      .eq('lot_id', lotId)

    const allotCount = count || 0
    const suffix = allotCount > 0 ? `-${allotCount + 1}` : ''
    setChallanNumber(`CH-${lotData.lot_number.replace(/[^a-zA-Z0-9-]/g, '')}${suffix}`)

    // 4. Load factories
    const { data: factoryRows } = await supabase
      .from('factories')
      .select('id, name, owner_name, phone, is_own, linked_business_id')
      .eq('business_id', business.id)
      .order('is_own', { ascending: false })
      .order('name', { ascending: true })

    if (factoryRows && factoryRows.length > 0) {
      const { factories: healed } = await autoLinkFactories(
        supabase,
        business.id,
        factoryRows as FactoryOption[]
      )
      setFactories(healed)
      setSelectedFactoryId(healed[0].id)
    }

    setLoading(false)
  }, [lotId, router, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Selected factory object
  const selectedFactory = factories.find((f) => f.id === selectedFactoryId)
  const isOwnFactory = Boolean(selectedFactory?.is_own)

  // Vepari rate per piece in this lot
  const vepariEffectiveRatePerPiece =
    lot && lot.total_pieces > 0 ? lot.total_amount / lot.total_pieces : 0

  const factoryRateNum = Number(ratePerPiece) || 0
  const factoryFullLotNum = Number(fullLotPrice) || 0
  const qtyToAllot = typeof piecesToAllot === 'number' && piecesToAllot > 0 ? piecesToAllot : 0

  const effectiveFactoryRatePerPiece = isOwnFactory
    ? 0
    : pricingType === 'per_piece'
    ? factoryRateNum
    : qtyToAllot > 0
    ? factoryFullLotNum / qtyToAllot
    : 0

  const calculatedFactoryPayable = isOwnFactory
    ? 0
    : pricingType === 'per_piece'
    ? qtyToAllot * factoryRateNum
    : factoryFullLotNum

  // Margin calculation
  const marginPerPiece = isOwnFactory
    ? vepariEffectiveRatePerPiece
    : vepariEffectiveRatePerPiece - effectiveFactoryRatePerPiece

  const totalExpectedProfit = marginPerPiece * qtyToAllot

  // Form submission: Allots the specified number of pieces (full or split!)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!lot) return

    if (lot.available_pieces <= 0) {
      setError('This lot has already been fully allotted.')
      return
    }

    if (qtyToAllot <= 0) {
      setError('Please enter a valid number of pieces to allot (at least 1 piece).')
      return
    }

    if (qtyToAllot > lot.available_pieces) {
      setError(`Cannot allot ${qtyToAllot} pieces. Only ${lot.available_pieces} pieces available in this lot.`)
      return
    }

    if (!selectedFactoryId) {
      setError('Please select a factory unit.')
      return
    }

    if (!challanNumber.trim()) {
      setError('Please enter an outward challan number.')
      return
    }

    if (!isOwnFactory && calculatedFactoryPayable <= 0) {
      setError('Please enter the factory rate or price.')
      return
    }

    setSubmitting(true)

    // 1. Insert into lot_allotments
    const { data: allotmentData, error: allotmentErr } = await supabase
      .from('lot_allotments')
      .insert({
        business_id: lot.business_id,
        lot_id: lot.id,
        factory_id: selectedFactoryId,
        challan_number: challanNumber.trim(),
        allotment_date: allotmentDate,
        expected_delivery_date: expectedDate || null,
        pricing_type: pricingType,
        rate_per_piece: effectiveFactoryRatePerPiece,
        total_amount: calculatedFactoryPayable,
        status: 'sent',
        notes: notes.trim() || null,
      })
      .select('id')
      .single()

    if (allotmentErr || !allotmentData) {
      setSubmitting(false)
      setError(allotmentErr?.message || 'Failed to save allotment.')
      return
    }

    // 2. Insert into allotment_items for EACH garment part with pieces clamped to available
    for (const item of lot.items) {
      const partQty = Math.min(qtyToAllot, Math.max(0, item.pieces - (item.allotted_pieces || 0)))
      const itemAmount = partQty * effectiveFactoryRatePerPiece

      await supabase.from('allotment_items').insert({
        business_id: lot.business_id,
        allotment_id: allotmentData.id,
        lot_item_id: item.id,
        work_type_name: item.work_type_name,
        pieces: partQty,
        rate: effectiveFactoryRatePerPiece,
        amount: itemAmount,
        returned_pieces: 0,
      })

      // Increment allotted_pieces by partQty
      await supabase
        .from('lot_items')
        .update({
          allotted_pieces: (item.allotted_pieces || 0) + partQty,
        })
        .eq('id', item.id)
    }

    // 3. Update parent lot status to 'in_progress'
    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lot.id)

    // 4. Mirror to partner factory account if linked
    try {
      await supabase.rpc('sync_partner_allotment_to_jobwork', {
        p_allotment_id: allotmentData.id,
      })
    } catch (e) {
      console.warn('Sync partner handoff notice:', e)
    }

    setSubmitting(false)
    router.push(`/lots/${lot.id}`)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!lot) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-800">Lot not found</h2>
        <Link href="/lots" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Back to Lots directory
        </Link>
      </div>
    )
  }

  // If already fully allotted, prevent re-allotting 0 pieces!
  if (lot.available_pieces <= 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/lots/${lot.id}`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Lot Details
          </Link>
        </div>

        <Card className="text-center p-8 border-blue-200 bg-blue-50/50 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Lot Already Fully Allotted</h2>
          <p className="text-sm text-gray-600 mt-2 mb-6">
            All {lot.total_pieces.toLocaleString('en-IN')} pieces of Lot "{lot.lot_number}" have already been allotted to factories.
          </p>
          <div className="flex justify-center gap-3">
            <Link href={`/lots/${lot.id}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                View Allotment Challans & Progress
              </Button>
            </Link>
            <Link href="/lots">
              <Button variant="outline">Back to Lots Directory</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/lots/${lot.id}`}
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Lot #{lot.lot_number}
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-6 h-6 text-indigo-600" />
              Allot Lot to Factory
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Select a factory, enter the number of pieces to assign, and issue an outward challan.
            </p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-right">
            <span className="text-2xs font-semibold uppercase text-indigo-700">Lot Summary</span>
            <p className="text-sm font-bold text-gray-900">
              {lot.lot_number} • {lot.vepari_name}
            </p>
            <p className="text-xs text-indigo-600">
              Total: {lot.total_pieces.toLocaleString('en-IN')} pcs (Vepari: ₹
              {vepariEffectiveRatePerPiece.toLocaleString('en-IN')}/pc)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FACTORY SELECTION & CHALLAN DETAILS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FactoryIcon className="w-4 h-4 text-indigo-600" />
              Factory & Delivery Challan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Split Quantity Input */}
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <Label htmlFor="pieces-to-allot" className="text-sm font-bold text-gray-900">
                    Number of Pieces (Suits) to Allot *
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Available to allot now: <b className="text-indigo-700">{lot.available_pieces} pcs</b>
                    {lot.allotted_pieces > 0 && ` (${lot.allotted_pieces} pcs already allotted)`}
                  </p>
                </div>

                <div className="w-full sm:w-48">
                  <Input
                    id="pieces-to-allot"
                    type="number"
                    min={1}
                    max={lot.available_pieces}
                    value={piecesToAllot}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setPiecesToAllot(val)
                    }}
                    className="font-bold text-lg bg-white border-indigo-300"
                    placeholder={`1 - ${lot.available_pieces}`}
                    required
                  />
                </div>
              </div>

              {typeof piecesToAllot === 'number' && piecesToAllot > 0 && piecesToAllot < lot.available_pieces && (
                <p className="text-2xs text-amber-800 font-medium mt-2.5 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Split Allotment Active: Assigning <b className="font-bold">{piecesToAllot} pcs</b> to this unit. The remaining <b className="font-bold">{lot.available_pieces - piecesToAllot} pcs</b> stay available in lot inventory.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Factory Dropdown */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="factory-select">Choose Factory / Unit *</Label>
                  <button
                    type="button"
                    onClick={() => setIsAddFactoryOpen(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add New Factory
                  </button>
                </div>
                <select
                  id="factory-select"
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                >
                  <option value="" disabled>
                    -- Select Factory --
                  </option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.is_own ? '— In-House Floor' : f.linked_business_id ? '— Linked Partner' : '— External Floor'}
                    </option>
                  ))}
                </select>
                {selectedFactory && (
                  <p className="text-2xs text-slate-500 font-mono mt-1">
                    {selectedFactory.is_own ? (
                      <span className="text-slate-700 font-medium">In-House machine unit (direct production floor)</span>
                    ) : selectedFactory.linked_business_id ? (
                      <span className="text-emerald-700 font-medium">
                        Linked Network Unit (electronic challan dispatch)
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        External Job Work Unit (WhatsApp slip dispatch)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Challan Number */}
              <div className="space-y-1">
                <Label htmlFor="challan-number">Outward Challan Number *</Label>
                <Input
                  id="challan-number"
                  placeholder="e.g. CH-740-1"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Dates & Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="allot-date">Allotment Date *</Label>
                <Input
                  id="allot-date"
                  type="date"
                  value={allotmentDate}
                  onChange={(e) => setAllotmentDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="expected-date">Expected Delivery Date</Label>
                <Input
                  id="expected-date"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Remarks / Thread Instructions</Label>
                <Input
                  id="notes"
                  placeholder="e.g. Gold zari, 3-ply thread"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FACTORY PRICING & PROFIT */}
        {!isOwnFactory ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Factory Rate & Expected Profit ({qtyToAllot} pcs)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setPricingType('per_piece')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    pricingType === 'per_piece'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Rate Per Piece (Suit)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('full_lot')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    pricingType === 'full_lot'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Full Lump Sum Price
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pricingType === 'per_piece' ? (
                  <div className="space-y-1">
                    <Label htmlFor="factory-rate">Factory Rate Per Piece (₹) *</Label>
                    <FormattedNumberInput
                      id="factory-rate"
                      prefix="₹ "
                      placeholder="e.g. 200"
                      value={ratePerPiece}
                      onChange={setRatePerPiece}
                      required
                    />
                    <p className="text-2xs text-gray-400">
                      Your Vepari rate is ₹{vepariEffectiveRatePerPiece.toLocaleString('en-IN')}/pc
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="full-lot-price">Total Agreed Challan Price (₹) *</Label>
                    <FormattedNumberInput
                      id="full-lot-price"
                      prefix="₹ "
                      placeholder="e.g. 40,000"
                      value={fullLotPrice}
                      onChange={setFullLotPrice}
                      required
                    />
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-right flex flex-col justify-center">
                  <span className="text-2xs font-semibold text-gray-500 uppercase">Total Factory Payable</span>
                  <p className="text-xl font-bold font-mono text-gray-900">
                    ₹{calculatedFactoryPayable.toLocaleString('en-IN')}
                  </p>
                  <p className="text-2xs text-gray-400">
                    {qtyToAllot} pcs × ₹{effectiveFactoryRatePerPiece.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Profit Indicator */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  totalExpectedProfit >= 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {totalExpectedProfit >= 0 ? 'Expected Net Margin' : 'Negative Margin Alert'}
                  </p>
                  <p className="text-2xs opacity-80 mt-0.5">
                    (Vepari Rate ₹{vepariEffectiveRatePerPiece.toLocaleString('en-IN')} - Factory Rate ₹
                    {effectiveFactoryRatePerPiece.toLocaleString('en-IN')}) × {qtyToAllot} pcs
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-mono">
                    ₹{totalExpectedProfit.toLocaleString('en-IN')}
                  </p>
                  <p className="text-2xs font-medium">
                    (₹{marginPerPiece.toLocaleString('en-IN')} / piece)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="text-sm font-bold text-indigo-950">In-House Production Unit</p>
              <p className="text-xs text-indigo-800">
                This lot is being produced on your own machines. No third-party contractor bill is created. Full receivable of ₹
                {(qtyToAllot * vepariEffectiveRatePerPiece).toLocaleString('en-IN')} is your company's revenue.
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/lots/${lot.id}`}>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting || qtyToAllot <= 0}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-xs px-6"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Allotting...' : `Confirm & Allot ${qtyToAllot} Pieces`}
          </Button>
        </div>
      </form>

      {/* Add Factory Modal */}
      {lot.business_id && (
        <AddFactoryModal
          isOpen={isAddFactoryOpen}
          onClose={() => setIsAddFactoryOpen(false)}
          businessId={lot.business_id}
          onFactoryAdded={(newFactory) => {
            setFactories((prev) => [...prev, newFactory])
            setSelectedFactoryId(newFactory.id)
          }}
        />
      )}
    </div>
  )
}
