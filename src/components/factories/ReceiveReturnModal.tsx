'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { ArrowDownLeft, AlertCircle, CheckCircle2 } from 'lucide-react'

interface AllotmentItemInfo {
  id: string
  lot_item_id: string
  work_type_name: string
  pieces: number
  returned_pieces: number
}

interface ReceiveReturnModalProps {
  isOpen: boolean
  onClose: () => void
  allotmentId: string
  challanNumber: string
  factoryName: string
  onReturnSaved: () => void
}

export default function ReceiveReturnModal({
  isOpen,
  onClose,
  allotmentId,
  challanNumber,
  factoryName,
  onReturnSaved,
}: ReceiveReturnModalProps) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<AllotmentItemInfo[]>([])
  const [returnedInputs, setReturnedInputs] = useState<{ [itemId: string]: number }>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allotmentId || !isOpen) return
    const loadItems = async () => {
      setLoading(true)
      setError(null)
      const { data } = await supabase
        .from('allotment_items')
        .select('id, lot_item_id, work_type_name, pieces, returned_pieces')
        .eq('allotment_id', allotmentId)

      if (data) {
        setItems(data)
        const initial: { [id: string]: number } = {}
        data.forEach((it) => {
          // Default to remaining unreturned pieces
          initial[it.id] = Math.max(0, it.pieces - (it.returned_pieces || 0))
        })
        setReturnedInputs(initial)
      }
      setLoading(false)
    }

    loadItems()
  }, [allotmentId, isOpen, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate
    for (const it of items) {
      const returningNow = returnedInputs[it.id] || 0
      const remaining = it.pieces - (it.returned_pieces || 0)
      if (returningNow > remaining) {
        setError(
          `Cannot return ${returningNow} pcs of ${it.work_type_name}. Only ${remaining} pcs pending.`
        )
        return
      }
    }

    setSaving(true)

    let allCompleted = true
    for (const it of items) {
      const returningNow = returnedInputs[it.id] || 0
      const newTotalReturned = (it.returned_pieces || 0) + returningNow

      if (newTotalReturned < it.pieces) {
        allCompleted = false
      }

      // 1. Update allotment_items
      await supabase
        .from('allotment_items')
        .update({ returned_pieces: newTotalReturned })
        .eq('id', it.id)

      // 2. Update lot_items
      if (it.lot_item_id && returningNow > 0) {
        const { data: curLotItem } = await supabase
          .from('lot_items')
          .select('returned_pieces')
          .eq('id', it.lot_item_id)
          .single()

        if (curLotItem) {
          await supabase
            .from('lot_items')
            .update({
              returned_pieces: (curLotItem.returned_pieces || 0) + returningNow,
            })
            .eq('id', it.lot_item_id)
        }
      }
    }

    // 3. Update allotment status
    await supabase
      .from('lot_allotments')
      .update({
        status: allCompleted ? 'completed' : 'in_progress',
      })
      .eq('id', allotmentId)

    setSaving(false)
    onReturnSaved()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Return: Challan #${challanNumber}`}
      description={`Record finished garment parts returned by ${factoryName}`}
      maxWidth="md"
    >
      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">Loading parts...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2.5">Garment Part</th>
                  <th className="px-3 py-2.5 text-center">Sent</th>
                  <th className="px-3 py-2.5 text-center">Prev. Returned</th>
                  <th className="px-3 py-2.5 text-right">Returning Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => {
                  const pending = it.pieces - (it.returned_pieces || 0)
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {it.work_type_name}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-600 font-mono">
                        {it.pieces} pcs
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500 font-mono">
                        {it.returned_pieces || 0} pcs
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <FormattedNumberInput
                          allowDecimals={false}
                          suffix="pcs"
                          placeholder="0"
                          disabled={pending <= 0}
                          value={returnedInputs[it.id] ?? ''}
                          onChange={(val) => {
                            setReturnedInputs((prev) => ({
                              ...prev,
                              [it.id]: Math.min(pending, val || 0),
                            }))
                          }}
                          className="h-8 text-right font-bold text-xs max-w-[110px] ml-auto"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
              <ArrowDownLeft className="w-4 h-4 mr-1.5" />
              Record Inward Return
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
