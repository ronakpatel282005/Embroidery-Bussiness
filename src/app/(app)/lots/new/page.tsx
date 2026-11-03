'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import AddVepariModal from '@/components/veparis/AddVepariModal'
import {
  ArrowLeft,
  Plus,
  Package,
  Layers,
  Check,
  X,
} from 'lucide-react'

interface WorkTypeItem {
  id: string
  name: string
}

interface VepariOption {
  id: string
  name: string
}

function NewLotForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialVepariId = searchParams.get('vepariId') || ''

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [veparis, setVeparis] = useState<VepariOption[]>([])
  const [workTypes, setWorkTypes] = useState<WorkTypeItem[]>([])
  const [selectedVepariId, setSelectedVepariId] = useState(initialVepariId)
  const [lotNumber, setLotNumber] = useState('')
  const [lotDate, setLotDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [designNumber, setDesignNumber] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  // 1 Piece contains multiple work types (Top, Plazo, Dupatta, etc.)
  const [totalPieces, setTotalPieces] = useState<number | ''>('')
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([])
  const [newWorkTypeName, setNewWorkTypeName] = useState('')
  const [isAddingCustomWorkType, setIsAddingCustomWorkType] = useState(false)

  // Pricing
  const [pricingType, setPricingType] = useState<'per_piece' | 'full_lot'>('per_piece')
  const [ratePerPiece, setRatePerPiece] = useState<number | ''>('')
  const [fullLotPrice, setFullLotPrice] = useState<number | ''>('')

  const [isAddVepariOpen, setIsAddVepariOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Load business, veparis, and work types
  const loadInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return
    setBusinessId(business.id)

    // Load veparis
    const { data: vData } = await supabase
      .from('veparis')
      .select('id, name')
      .eq('business_id', business.id)
      .order('name', { ascending: true })

    const vepList = vData || []
    setVeparis(vepList)
    if (initialVepariId) {
      setSelectedVepariId(initialVepariId)
    } else if (vepList.length > 0 && !selectedVepariId) {
      setSelectedVepariId(vepList[0].id)
    }

    // Load work types from master settings
    const { data: wData } = await supabase
      .from('work_types')
      .select('id, name')
      .eq('business_id', business.id)
      .order('name', { ascending: true })

    const wtList = wData || []
    setWorkTypes(wtList)

    // Default select first 2-3 work types if available
    if (wtList.length > 0 && selectedWorkTypes.length === 0) {
      setSelectedWorkTypes(wtList.slice(0, 2).map((w) => w.name))
    }
  }, [initialVepariId, router, selectedVepariId, selectedWorkTypes.length, supabase])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Toggle work type selection
  const toggleWorkType = (name: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  // Add custom work type on the fly
  const handleAddCustomWorkType = async () => {
    const trimmed = newWorkTypeName.trim()
    if (!trimmed || !businessId) return

    // Save to database work_types
    const { data, error: err } = await supabase
      .from('work_types')
      .insert({ business_id: businessId, name: trimmed })
      .select('id, name')
      .single()

    if (!err && data) {
      setWorkTypes((prev) => [...prev, data])
      setSelectedWorkTypes((prev) => [...prev, data.name])
      setNewWorkTypeName('')
      setIsAddingCustomWorkType(false)
    }
  }

  // Compute calculated amounts
  const piecesNum = Number(totalPieces) || 0
  const rateNum = Number(ratePerPiece) || 0
  const fullLotNum = Number(fullLotPrice) || 0

  const calculatedTotalAmount =
    pricingType === 'per_piece' ? piecesNum * rateNum : fullLotNum

  const effectiveRatePerPiece =
    pricingType === 'per_piece'
      ? rateNum
      : piecesNum > 0
      ? fullLotNum / piecesNum
      : 0

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedVepariId) {
      setError('Please select a vepari.')
      return
    }

    if (!lotNumber.trim()) {
      setError('Please enter a lot number.')
      return
    }

    if (piecesNum <= 0) {
      setError('Please enter the total number of pieces in this lot.')
      return
    }

    if (selectedWorkTypes.length === 0) {
      setError('Please select at least one work type/part included in this lot (e.g. Top, Plazo).')
      return
    }

    if (calculatedTotalAmount <= 0) {
      setError('Please enter a valid price/rate for this lot.')
      return
    }

    setIsSubmitting(true)

    // 1. Insert Lot Record
    const { data: lotData, error: lotErr } = await supabase
      .from('lots')
      .insert({
        business_id: businessId,
        vepari_id: selectedVepariId,
        lot_number: lotNumber.trim(),
        date: lotDate,
        due_date: dueDate || null,
        design_number: designNumber.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        pricing_type: pricingType,
        total_pieces: piecesNum,
        total_amount: calculatedTotalAmount,
        status: 'received',
      })
      .select('id')
      .single()

    if (lotErr || !lotData) {
      setIsSubmitting(false)
      setError(lotErr?.message || 'Failed to save lot.')
      return
    }

    // 2. Insert Lot Items (Each piece contains each selected work type!)
    // For 240 pieces with Top & Plazo: creates 240 Tops and 240 Plazos
    const itemsToInsert = selectedWorkTypes.map((wtName) => {
      const matched = workTypes.find((w) => w.name.toLowerCase() === wtName.toLowerCase())
      return {
        business_id: businessId,
        lot_id: lotData.id,
        work_type_id: matched?.id || null,
        work_type_name: wtName,
        pieces: piecesNum,
        rate: effectiveRatePerPiece,
        amount: calculatedTotalAmount,
        allotted_pieces: 0,
        returned_pieces: 0,
      }
    })

    const { error: itemsErr } = await supabase.from('lot_items').insert(itemsToInsert)

    setIsSubmitting(false)

    if (itemsErr) {
      setError(`Lot created, but items failed: ${itemsErr.message}`)
    } else {
      router.push(`/lots/${lotData.id}`)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Back Button */}
      <div className="mb-4">
        <Link
          href={selectedVepariId ? `/veparis/${selectedVepariId}` : '/lots'}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          {selectedVepariId ? 'Back to Vepari' : 'Back to Lots Directory'}
        </Link>
      </div>

      <div className="pb-6 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Production Floor</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500 font-medium">Inward Intake</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Inward New Lot Entry</h1>
        <p className="text-xs text-slate-500 mt-1">
          Record incoming work lot from trader. Define total piece count, constituent garment components, and rate agreement.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1: VEPARI & LOT BASIC DETAILS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              Lot Information
            </CardTitle>
            <CardDescription>Select the vepari (trader) and lot identification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vepari Selector with Quick Add */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vepari-select">Select Vepari (Trader) *</Label>
                  <button
                    type="button"
                    onClick={() => setIsAddVepariOpen(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New Vepari
                  </button>
                </div>
                <select
                  id="vepari-select"
                  value={selectedVepariId}
                  onChange={(e) => setSelectedVepariId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="" disabled>
                    -- Select Vepari --
                  </option>
                  {veparis.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lot Number */}
              <div className="space-y-1">
                <Label htmlFor="lot-number">Lot Number / Challan Number *</Label>
                <Input
                  id="lot-number"
                  placeholder="e.g. Lot #101 or Challan #452"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Dates & Design Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="lot-date">Received Date *</Label>
                <Input
                  id="lot-date"
                  type="date"
                  value={lotDate}
                  onChange={(e) => setLotDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="due-date">Due / Delivery Date (Optional)</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="design-number">Design Number (Optional)</Label>
                <Input
                  id="design-number"
                  placeholder="e.g. D-4502 / Peacock"
                  value={designNumber}
                  onChange={(e) => setDesignNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Description & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="description">Fabric / Garment Description</Label>
                <Input
                  id="description"
                  placeholder="e.g. Georgette Suit, Silk Kurti"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Special Remarks / Instructions</Label>
                <Input
                  id="notes"
                  placeholder="e.g. Match dori color, finish by Friday"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: PIECES & INCLUDED WORK TYPES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Lot Quantity & Garment Parts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Total Pieces */}
            <div className="max-w-xs space-y-1">
              <Label htmlFor="total-pieces" className="text-sm font-semibold text-gray-900">
                Total Pieces in this Lot *
              </Label>
              <FormattedNumberInput
                id="total-pieces"
                allowDecimals={false}
                suffix="pcs"
                placeholder="e.g. 240"
                value={totalPieces}
                onChange={(num) => setTotalPieces(num || '')}
                className="font-bold text-lg h-11"
                required
              />
            </div>

            {/* Work Types / Garment Parts Selection Pills */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                Parts Included in Each Piece *
              </Label>
              <p className="text-xs text-gray-500">
                Click to select which parts come with this lot (these will be available for allotment to factories):
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {workTypes.map((wt) => {
                  const isSelected = selectedWorkTypes.includes(wt.name)
                  return (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => toggleWorkType(wt.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-slate-300" />}
                      <span>{wt.name}</span>
                    </button>
                  )
                })}

                {/* Inline Add Custom Work Type */}
                {isAddingCustomWorkType ? (
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-lg p-1">
                    <Input
                      placeholder="e.g. Dupatta, Kali..."
                      value={newWorkTypeName}
                      onChange={(e) => setNewWorkTypeName(e.target.value)}
                      className="h-8 text-xs w-36"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomWorkType()
                        }
                        if (e.key === 'Escape') setIsAddingCustomWorkType(false)
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomWorkType}
                      className="h-8 px-2 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomWorkType(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomWorkType(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Other Part
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: VEPARI PRICING */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Vepari Price (Receivable)</CardTitle>
                <CardDescription>
                  How much the trader is paying you for this lot
                </CardDescription>
              </div>

              {/* Pricing Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPricingType('per_piece')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    pricingType === 'per_piece'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rate Per Piece (Suit)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('full_lot')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    pricingType === 'full_lot'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Lot Total Price
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {pricingType === 'per_piece' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <Label htmlFor="rate-per-piece" className="text-sm font-semibold text-gray-900">
                    Rate Per Piece / Suit (₹) *
                  </Label>
                  <FormattedNumberInput
                    id="rate-per-piece"
                    prefix="₹"
                    placeholder="e.g. 100"
                    value={ratePerPiece}
                    onChange={(num) => setRatePerPiece(num || '')}
                    className="font-bold text-lg h-11"
                    required
                  />
                  <p className="text-xs text-gray-400">
                    Vepari pays this rate for 1 complete piece
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">Calculation</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {piecesNum.toLocaleString('en-IN')} pcs × {formatCurrency(rateNum)} / pc =
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 font-mono mt-0.5">
                    {formatCurrency(calculatedTotalAmount)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <Label htmlFor="full-lot-price" className="text-sm font-semibold text-gray-900">
                    Total Lump Sum Lot Price (₹) *
                  </Label>
                  <FormattedNumberInput
                    id="full-lot-price"
                    prefix="₹"
                    placeholder="e.g. 24,000"
                    value={fullLotPrice}
                    onChange={(num) => setFullLotPrice(num || '')}
                    className="font-bold text-lg h-11"
                    required
                  />
                  <p className="text-xs text-gray-400">
                    Fixed total amount agreed with the trader for the whole lot
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">Average Per Piece Rate</p>
                  <p className="text-2xl font-bold text-indigo-600 font-mono mt-1">
                    {formatCurrency(effectiveRatePerPiece)} <span className="text-xs font-normal text-gray-500">/ pc</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ({formatCurrency(fullLotNum)} ÷ {piecesNum.toLocaleString('en-IN')} pcs)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SUMMARY & SUBMIT BAR */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Total Pieces</p>
              <p className="text-2xl font-bold text-gray-900">{piecesNum} pcs</p>
              <p className="text-xs text-gray-500">{selectedWorkTypes.length} parts included</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Total Amount Due (Receivable)</p>
              <p className="text-2xl font-bold text-indigo-600 font-mono">
                {formatCurrency(calculatedTotalAmount)}
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(effectiveRatePerPiece)} per piece
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="h-8 text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs min-w-36"
            >
              Inward & Register Lot
            </Button>
          </div>
        </div>
      </form>

      {/* Add Vepari Modal (if opened on the fly) */}
      {businessId && (
        <AddVepariModal
          isOpen={isAddVepariOpen}
          onClose={() => setIsAddVepariOpen(false)}
          businessId={businessId}
          onVepariAdded={(newV) => {
            setVeparis((prev) => [...prev, newV].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedVepariId(newV.id)
          }}
        />
      )}
    </div>
  )
}

export default function NewLotPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <NewLotForm />
    </Suspense>
  )
}
