'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { formatCurrency } from '@/lib/utils'
import { Check, Plus, X, Layers, AlertCircle } from 'lucide-react'

interface WorkType {
  id: string
  name: string
}

interface Vepari {
  id: string
  name: string
}

interface EditLotModalProps {
  isOpen: boolean
  onClose: () => void
  lotId: string
  businessId: string
  onLotUpdated: () => void
}

export default function EditLotModal({
  isOpen,
  onClose,
  lotId,
  businessId,
  onLotUpdated,
}: EditLotModalProps) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dropdown options
  const [veparis, setVeparis] = useState<Vepari[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  // Form State
  const [selectedVepariId, setSelectedVepariId] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [lotDate, setLotDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [designNumber, setDesignNumber] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  // Pieces & Parts
  const [totalPieces, setTotalPieces] = useState<number | string>('')
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([])
  const [newWorkTypeName, setNewWorkTypeName] = useState('')
  const [isAddingCustomWorkType, setIsAddingCustomWorkType] = useState(false)

  // Pricing
  const [pricingType, setPricingType] = useState<'per_piece' | 'full_lot'>('per_piece')
  const [ratePerPiece, setRatePerPiece] = useState<number | string>('')
  const [fullLotPrice, setFullLotPrice] = useState<number | string>('')

  // Existing lot items to preserve allotment counts
  const [existingItems, setExistingItems] = useState<any[]>([])

  // Load Lot Details & Master Lists
  const loadLotData = useCallback(async () => {
    if (!lotId || !isOpen) return
    setLoading(true)
    setError(null)

    // 1. Load Veparis
    const { data: vData } = await supabase
      .from('veparis')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name', { ascending: true })
    if (vData) setVeparis(vData)

    // 2. Load Work Types
    const { data: wtData } = await supabase
      .from('work_types')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name', { ascending: true })
    if (wtData) setWorkTypes(wtData)

    // 3. Load Lot
    const { data: lot, error: lotErr } = await supabase
      .from('lots')
      .select('*')
      .eq('id', lotId)
      .single()

    if (lotErr || !lot) {
      setError('Failed to load lot.')
      setLoading(false)
      return
    }

    // 4. Load Lot Items
    const { data: items } = await supabase
      .from('lot_items')
      .select('*')
      .eq('lot_id', lotId)

    setExistingItems(items || [])

    // Pre-fill fields
    setSelectedVepariId(lot.vepari_id)
    setLotNumber(lot.lot_number)
    setLotDate(lot.date)
    setDueDate(lot.due_date || '')
    setDesignNumber(lot.design_number || '')
    setDescription(lot.description || '')
    setNotes(lot.notes || '')
    setTotalPieces(lot.total_pieces)
    setPricingType(lot.pricing_type === 'full_lot' ? 'full_lot' : 'per_piece')

    if (lot.pricing_type === 'full_lot') {
      setFullLotPrice(lot.total_amount)
      setRatePerPiece(lot.total_pieces > 0 ? lot.total_amount / lot.total_pieces : '')
    } else {
      const perPiece = lot.total_pieces > 0 ? lot.total_amount / lot.total_pieces : 0
      setRatePerPiece(perPiece)
      setFullLotPrice(lot.total_amount)
    }

    if (items) {
      setSelectedWorkTypes(items.map((i) => i.work_type_name))
    }

    setLoading(false)
  }, [lotId, isOpen, businessId, supabase])

  useEffect(() => {
    loadLotData()
  }, [loadLotData])

  // Calculation helpers
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

  const toggleWorkType = (name: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleAddCustomWorkType = async () => {
    const trimmed = newWorkTypeName.trim()
    if (!trimmed) return

    if (!workTypes.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      const { data } = await supabase
        .from('work_types')
        .insert({ business_id: businessId, name: trimmed })
        .select('id, name')
        .single()

      if (data) {
        setWorkTypes((prev) => [...prev, data])
      }
    }

    if (!selectedWorkTypes.includes(trimmed)) {
      setSelectedWorkTypes((prev) => [...prev, trimmed])
    }
    setNewWorkTypeName('')
    setIsAddingCustomWorkType(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!lotNumber.trim()) {
      setError('Please enter a lot / challan number.')
      return
    }

    if (piecesNum <= 0) {
      setError('Please enter valid total pieces.')
      return
    }

    if (selectedWorkTypes.length === 0) {
      setError('Please select at least one garment part.')
      return
    }

    if (calculatedTotalAmount <= 0) {
      setError('Please enter a valid price/rate.')
      return
    }

    setSaving(true)

    // 1. Update Lot Record
    const { error: updateErr } = await supabase
      .from('lots')
      .update({
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
      })
      .eq('id', lotId)

    if (updateErr) {
      setSaving(false)
      setError(updateErr.message)
      return
    }

    // 2. Sync Lot Items (garment parts)
    for (const wtName of selectedWorkTypes) {
      const existing = existingItems.find(
        (ei) => ei.work_type_name.toLowerCase() === wtName.toLowerCase()
      )
      if (existing) {
        // Update existing item pieces and rate
        await supabase
          .from('lot_items')
          .update({
            pieces: piecesNum,
            rate: effectiveRatePerPiece,
            amount: calculatedTotalAmount,
          })
          .eq('id', existing.id)
      } else {
        // Insert newly added part
        const matchedWt = workTypes.find((w) => w.name.toLowerCase() === wtName.toLowerCase())
        await supabase.from('lot_items').insert({
          business_id: businessId,
          lot_id: lotId,
          work_type_id: matchedWt?.id || null,
          work_type_name: wtName,
          pieces: piecesNum,
          rate: effectiveRatePerPiece,
          amount: calculatedTotalAmount,
          allotted_pieces: 0,
          returned_pieces: 0,
        })
      }
    }

    // Remove unselected parts if they have 0 allotments
    for (const ei of existingItems) {
      if (!selectedWorkTypes.includes(ei.work_type_name)) {
        if ((ei.allotted_pieces || 0) === 0) {
          await supabase.from('lot_items').delete().eq('id', ei.id)
        }
      }
    }

    setSaving(false)
    onLotUpdated()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Lot / Challan"
      description="Update pricing, quantity, parts, or vepari information"
      maxWidth="xl"
    >
      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading lot information...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto px-1">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Vepari & Lot / Challan # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-vepari">Vepari (Trader) *</Label>
              <select
                id="edit-vepari"
                value={selectedVepariId}
                onChange={(e) => setSelectedVepariId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                {veparis.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-lot-num">Lot Number / Challan Number *</Label>
              <Input
                id="edit-lot-num"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Dates & Design # */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-lot-date">Received Date *</Label>
              <Input
                id="edit-lot-date"
                type="date"
                value={lotDate}
                onChange={(e) => setLotDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-due-date">Due / Delivery Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-design">Design Number</Label>
              <Input
                id="edit-design"
                placeholder="e.g. D-402"
                value={designNumber}
                onChange={(e) => setDesignNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Fabric & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-desc">Fabric / Garment Description</Label>
              <Input
                id="edit-desc"
                placeholder="e.g. Georgette Suit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-notes">Special Remarks / Notes</Label>
              <Input
                id="edit-notes"
                placeholder="e.g. Gold thread"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Total Pieces */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="max-w-xs space-y-1">
              <Label htmlFor="edit-total-pieces" className="text-xs font-bold text-gray-800">
                Total Pieces in this Lot *
              </Label>
              <FormattedNumberInput
                id="edit-total-pieces"
                allowDecimals={false}
                suffix="pcs"
                placeholder="e.g. 240"
                value={totalPieces}
                onChange={(num) => setTotalPieces(num || '')}
                className="font-bold text-base h-10"
                required
              />
            </div>

            {/* Garment Parts Pills */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Parts Included in Each Piece *
              </Label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {workTypes.map((wt) => {
                  const isSelected = selectedWorkTypes.includes(wt.name)
                  return (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => toggleWorkType(wt.name)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{wt.name}</span>
                    </button>
                  )
                })}

                {/* Inline add custom part */}
                {isAddingCustomWorkType ? (
                  <div className="inline-flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-0.5">
                    <Input
                      placeholder="e.g. Dupatta"
                      value={newWorkTypeName}
                      onChange={(e) => setNewWorkTypeName(e.target.value)}
                      className="h-7 text-xs w-28"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomWorkType}
                      className="h-7 px-2 text-xs"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomWorkType(false)}
                      className="p-1 text-gray-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomWorkType(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600"
                  >
                    <Plus className="w-3 h-3" />
                    Add Part
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Toggle & Inputs */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-gray-800">Vepari Price (Receivable)</Label>
              <div className="flex items-center bg-gray-200 p-0.5 rounded-md text-xs">
                <button
                  type="button"
                  onClick={() => setPricingType('per_piece')}
                  className={`px-2.5 py-0.5 font-medium rounded ${
                    pricingType === 'per_piece'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600'
                  }`}
                >
                  Rate Per Piece
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('full_lot')}
                  className={`px-2.5 py-0.5 font-medium rounded ${
                    pricingType === 'full_lot'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600'
                  }`}
                >
                  Full Lot Price
                </button>
              </div>
            </div>

            {pricingType === 'per_piece' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <Label htmlFor="edit-rate" className="text-xs font-medium text-gray-700">
                    Rate Per Piece / Suit (₹) *
                  </Label>
                  <FormattedNumberInput
                    id="edit-rate"
                    prefix="₹"
                    placeholder="e.g. 100"
                    value={ratePerPiece}
                    onChange={(num) => setRatePerPiece(num || '')}
                    className="font-bold text-base h-10"
                    required
                  />
                </div>
                <div className="p-2.5 bg-white rounded-md border border-gray-200 text-right">
                  <p className="text-2xs text-gray-400">Total Lot Receivable</p>
                  <p className="text-lg font-bold text-indigo-600 font-mono">
                    {formatCurrency(calculatedTotalAmount)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <Label htmlFor="edit-full-price" className="text-xs font-medium text-gray-700">
                    Total Lump Sum Amount (₹) *
                  </Label>
                  <FormattedNumberInput
                    id="edit-full-price"
                    prefix="₹"
                    placeholder="e.g. 24,000"
                    value={fullLotPrice}
                    onChange={(num) => setFullLotPrice(num || '')}
                    className="font-bold text-base h-10"
                    required
                  />
                </div>
                <div className="p-2.5 bg-white rounded-md border border-gray-200 text-right">
                  <p className="text-2xs text-gray-400">Average Rate Per Piece</p>
                  <p className="text-lg font-bold text-indigo-600 font-mono">
                    {formatCurrency(effectiveRatePerPiece)} <span className="text-xs font-normal">/ pc</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
