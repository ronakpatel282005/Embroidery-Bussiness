'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  Calendar,
  Layers,
  Send,
  ExternalLink,
  Factory as FactoryIcon,
  MessageCircle,
  Clock,
  CheckCircle2,
  Edit2,
  Trash2,
  Building2,
  RotateCcw,
} from 'lucide-react'
import EditLotModal from '@/components/lots/EditLotModal'

interface LotItemDetail {
  id: string
  work_type_name: string
  pieces: number
  rate: number
  amount: number
  allotted_pieces: number
  returned_pieces: number
}

interface AllotmentDetail {
  id: string
  challan_number: string
  allotment_date: string
  expected_delivery_date: string | null
  pricing_type: string
  rate_per_piece: number
  total_amount: number
  status: string
  notes: string | null
  factory_name: string
  factory_phone: string | null
  factory_is_own: boolean
  factory_linked: boolean
  items: {
    work_type_name: string
    pieces: number
    rate: number
    amount: number
  }[]
}

interface LotDetail {
  id: string
  lot_number: string
  vepari_id: string
  vepari_name: string
  origin_allotment_id?: string | null
  date: string
  due_date: string | null
  design_number: string | null
  description: string | null
  pricing_type: string
  total_pieces: number
  allotted_pieces: number
  total_amount: number
  status: string
  notes: string | null
  items: LotItemDetail[]
}

export default function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const lotId = resolvedParams.id
  const router = useRouter()

  const [lot, setLot] = useState<LotDetail | null>(null)
  const [allotments, setAllotments] = useState<AllotmentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const supabase = createClient()

  const loadLot = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: lotData, error: lotErr } = await supabase
      .from('lots')
      .select(`
        *,
        veparis(id, name),
        origin_allotment:lot_allotments!origin_allotment_id (
          id, rate_per_piece, total_amount,
          allotment_items (pieces, work_type_name, rate, amount)
        )
      `)
      .eq('id', lotId)
      .single()

    if (lotErr || !lotData) {
      setLoading(false)
      return
    }

    setBusinessId(lotData.business_id)

    // Load items (parts in this lot)
    const { data: itemsData } = await supabase
      .from('lot_items')
      .select('*')
      .eq('lot_id', lotId)
      .order('work_type_name', { ascending: true })

    const originPieces = (lotData.origin_allotment?.allotment_items || []).reduce(
      (max: number, ai: any) => Math.max(max, ai.pieces || 0),
      0
    )

    const mappedItems = (itemsData || []).map((i) => {
      const truePieces = lotData.origin_allotment_id && originPieces > 0 ? originPieces : i.pieces
      return {
        id: i.id,
        work_type_name: i.work_type_name,
        pieces: truePieces,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
        allotted_pieces: i.allotted_pieces || 0,
        returned_pieces: i.returned_pieces || 0,
      }
    })

    const maxPartPieces = mappedItems.reduce((max, it) => Math.max(max, it.pieces || 0), 0)
    const isSummedPieces =
      mappedItems.length > 1 &&
      maxPartPieces > 0 &&
      lotData.total_pieces === mappedItems.reduce((sum, it) => sum + (it.pieces || 0), 0)
    // For incoming partner jobs (e.g. 40 pcs allotted to Shree Krishna), total lot size is 40 pcs, NOT parent's 240!
    const normalizedPieces = lotData.origin_allotment_id
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
    const maxAllotted = mappedItems.reduce((max, it) => Math.max(max, it.allotted_pieces || 0), 0)

    setLot({
      id: lotData.id,
      lot_number: lotData.lot_number,
      vepari_id: lotData.vepari_id,
      vepari_name: lotData.veparis?.name || 'Unknown Vepari',
      origin_allotment_id: lotData.origin_allotment_id,
      date: lotData.date,
      due_date: lotData.due_date,
      design_number: lotData.design_number,
      description: lotData.description,
      pricing_type: lotData.pricing_type,
      total_pieces: normalizedPieces,
      allotted_pieces: maxAllotted,
      total_amount: Number(lotData.total_amount) || 0,
      status: lotData.status,
      notes: lotData.notes,
      items: mappedItems,
    })

    // Load allotments
    try {
      const { data: allotRows } = await supabase
        .from('lot_allotments')
        .select(`
          id, challan_number, allotment_date, expected_delivery_date,
          pricing_type, rate_per_piece, total_amount, status, notes,
          factories (name, phone, is_own, linked_business_id),
          allotment_items (work_type_name, pieces, rate, amount)
        `)
        .eq('lot_id', lotId)
        .order('created_at', { ascending: false })

      if (allotRows) {
        setAllotments(
          allotRows.map((a: any) => ({
            id: a.id,
            challan_number: a.challan_number,
            allotment_date: a.allotment_date,
            expected_delivery_date: a.expected_delivery_date,
            pricing_type: a.pricing_type,
            rate_per_piece: Number(a.rate_per_piece) || 0,
            total_amount: Number(a.total_amount) || 0,
            status: a.status,
            notes: a.notes,
            factory_name: a.factories?.name || 'Unknown Factory',
            factory_phone: a.factories?.phone || null,
            factory_is_own: Boolean(a.factories?.is_own),
            factory_linked: Boolean(a.factories?.linked_business_id),
            items: (a.allotment_items || []).map((ai: any) => ({
              work_type_name: ai.work_type_name,
              pieces: ai.pieces,
              rate: Number(ai.rate) || 0,
              amount: Number(ai.amount) || 0,
            })),
          }))
        )
      }
    } catch (e) {
      console.warn('Could not load allotments yet:', e)
    }

    setLoading(false)
  }, [lotId, router, supabase])

  // Status Change for Lot (Cascades upstream to client if this is a partner job!)
  const handleUpdateLotStatus = async (newStatus: 'completed' | 'in_progress' | 'received') => {
    if (!lot) return
    setUpdatingStatus(true)
    const { error } = await supabase.from('lots').update({ status: newStatus }).eq('id', lot.id)
    setUpdatingStatus(false)
    if (error) {
      alert(`Failed to update status: ${error.message}`)
    } else {
      loadLot()
    }
  }

  // Status Change for Individual Allotment (Cascades to sub-factory lot and parent lot!)
  const handleToggleAllotmentStatus = async (allotmentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'in_progress' : 'completed'
    const { error } = await supabase
      .from('lot_allotments')
      .update({ status: nextStatus })
      .eq('id', allotmentId)

    if (error) {
      alert(`Failed to update allotment status: ${error.message}`)
    } else {
      loadLot()
    }
  }

  const handleDeleteLot = async () => {
    if (!lot) return
    const promptMsg = lot.origin_allotment_id
      ? `Delete Lot "${lot.lot_number}" received from "${lot.vepari_name}"?\n\nThis will remove this lot and all related factory outward allotments.`
      : `Are you sure you want to delete Lot "${lot.lot_number}"?\n\nThis will permanently delete this lot and all related factory allotments.`

    const confirmed = window.confirm(promptMsg)
    if (!confirmed) return

    const { error: delErr } = await supabase.from('lots').delete().eq('id', lot.id)
    if (delErr) {
      alert(`Failed to delete lot: ${delErr.message}`)
    } else {
      router.push('/lots')
    }
  }

  const handleDeleteAllotment = async (allot: AllotmentDetail) => {
    const confirmed = window.confirm(
      `Cancel / Delete Challan "${allot.challan_number}" allotted to "${allot.factory_name}"?\n\nThis will restore the allotted pieces back to the available pool.`
    )
    if (!confirmed) return

    // 1. Fetch items of this allotment to subtract allotted_pieces
    const { data: allotItems } = await supabase
      .from('allotment_items')
      .select('lot_item_id, pieces')
      .eq('allotment_id', allot.id)

    if (allotItems) {
      for (const item of allotItems) {
        if (item.lot_item_id) {
          const { data: cur } = await supabase
            .from('lot_items')
            .select('allotted_pieces')
            .eq('id', item.lot_item_id)
            .single()
          if (cur) {
            await supabase
              .from('lot_items')
              .update({
                allotted_pieces: Math.max(0, (cur.allotted_pieces || 0) - item.pieces),
              })
              .eq('id', item.lot_item_id)
          }
        }
      }
    }

    // 2. Delete allotment
    const { error: delErr } = await supabase
      .from('lot_allotments')
      .delete()
      .eq('id', allot.id)

    if (delErr) {
      alert(`Failed to delete allotment: ${delErr.message}`)
      return
    }

    loadLot()
  }

  const handleUnallotAll = async () => {
    if (!lot) return
    const confirmed = window.confirm(
      `Unallot all factory challans for Lot "${lot.lot_number}"?\n\nThis will cancel all outward allotments and return all ${lot.total_pieces} pieces to available.`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase
      .from('lot_allotments')
      .delete()
      .eq('lot_id', lot.id)

    if (delErr) {
      alert(`Could not unallot: ${delErr.message}`)
      return
    }

    await supabase
      .from('lot_items')
      .update({ allotted_pieces: 0 })
      .eq('lot_id', lot.id)

    await supabase
      .from('lots')
      .update({ status: 'received' })
      .eq('id', lot.id)

    loadLot()
  }

  useEffect(() => {
    loadLot()
  }, [loadLot])

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

  const isOverdue =
    lot.due_date && new Date(lot.due_date) < new Date() && lot.status !== 'completed'

  const perPieceRate = lot.total_pieces > 0 ? lot.total_amount / lot.total_pieces : 0

  // Total remaining pieces across all garment parts
  const hasRemainingPieces = lot.items.some((i) => i.pieces - i.allotted_pieces > 0)

  return (
    <div className="p-8 max-w-6xl">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/lots"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Lots Directory
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-mono">{lot.lot_number}</h1>
              <span
                className={`px-2.5 py-0.5 rounded text-2xs font-semibold capitalize font-mono ${
                  lot.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : lot.status === 'in_progress'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {lot.status.replace('_', ' ')}
              </span>

              {lot.origin_allotment_id && (
                <span className="inline-flex items-center gap-1 font-semibold text-2xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  Received from {lot.vepari_name}
                </span>
              )}

              {lot.design_number && (
                <span className="font-mono text-2xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  Design: {lot.design_number}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2 font-mono">
              <Link
                href={`/veparis/${lot.vepari_id}`}
                className="font-medium text-slate-900 hover:underline flex items-center gap-1"
              >
                <span>Client: {lot.vepari_name}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </Link>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Inward: {formatDate(lot.date)}</span>
              </div>
              {lot.due_date && (
                <>
                  <span className="text-slate-300">•</span>
                  <div
                    className={`flex items-center gap-1 ${
                      isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    <span>Delivery: {formatDate(lot.due_date)}</span>
                    {isOverdue && (
                      <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-2xs font-bold uppercase">
                        Overdue
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {lot.description && (
              <p className="text-xs text-slate-600 mt-2 bg-slate-50 px-3 py-1.5 rounded border border-slate-100 w-fit">
                {lot.description}
              </p>
            )}

            {lot.items.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-2xs text-slate-600 font-bold uppercase tracking-wider mr-1">Parts:</span>
                {lot.items.map((i) => (
                  <span
                    key={i.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-2xs bg-slate-100 text-slate-700 font-medium border border-slate-200"
                  >
                    {i.work_type_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {lot.status === 'completed' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateLotStatus('in_progress')}
                disabled={updatingStatus}
                className="h-8 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Reopen Lot
              </Button>
            ) : allotments.some((a) => !a.factory_is_own) ? (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded text-2xs font-mono font-semibold bg-slate-100 border border-slate-200 text-slate-700"
              >
                <Clock className="w-3 h-3 text-slate-500 animate-pulse" />
                <span>
                  {allotments.some((a) => a.factory_linked)
                    ? 'In Production (Partner)'
                    : 'Allotted Outward'}
                </span>
              </div>
            ) : allotments.length > 0 && allotments.every((a) => a.factory_is_own) ? (
              <Button
                size="sm"
                onClick={() => handleUpdateLotStatus('completed')}
                disabled={updatingStatus}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Mark Completed
              </Button>
            ) : lot.origin_allotment_id && allotments.length === 0 ? (
              <Button
                size="sm"
                onClick={() => handleUpdateLotStatus('completed')}
                disabled={updatingStatus}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Mark Completed
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Edit2 className="w-3 h-3 mr-1 text-slate-400" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteLot}
              className="h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>

            {hasRemainingPieces && lot.status !== 'completed' ? (
              <Link href={`/lots/${lot.id}/allot`}>
                <Button size="sm" className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs">
                  <Send className="w-3 h-3 mr-1.5 text-slate-300" />
                  {lot.allotted_pieces > 0
                    ? `Allot Remaining (${lot.total_pieces - lot.allotted_pieces} pcs)`
                    : 'Allot to Factory'}
                </Button>
              </Link>
            ) : null}

            {lot.allotted_pieces > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnallotAll}
                className="h-8 text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50 shadow-2xs"
              >
                <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                Unallot All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Unified Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-2xs mb-6 overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-600">
            Total Pieces in Lot
          </p>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight mt-1">
            {lot.total_pieces.toLocaleString('en-IN')} pcs
          </p>
          <p className="text-2xs text-slate-600 mt-1 font-mono">
            {lot.items.map((i) => `${i.work_type_name} (${i.pieces})`).join(', ')}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-600">
            Rate / Piece
          </p>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight mt-1">
            {formatCurrency(perPieceRate)}
          </p>
          <p className="text-2xs text-slate-600 mt-1 capitalize font-mono">
            {lot.pricing_type === 'per_piece' ? 'Unit Piece Basis' : 'Full Lot Lump Sum'}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-600">
            Total Lot Value (Receivable)
          </p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tracking-tight mt-1">
            {formatCurrency(lot.total_amount)}
          </p>
          <p className="text-2xs text-slate-600 mt-1 font-mono">Agreed with client ledger</p>
        </div>
      </div>


      {/* ALLOTMENTS HISTORY CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FactoryIcon className="w-3.5 h-3.5 text-slate-500" />
              Factory Outward Allotments ({allotments.length})
            </h2>
            <p className="text-2xs text-slate-600 mt-0.5">
              Production challans dispatched to in-house floor or outsourced partner factories
            </p>
          </div>
          {hasRemainingPieces && (
            <Link href={`/lots/${lot.id}/allot`}>
              <Button size="sm" variant="outline" className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
                <Send className="w-3 h-3 mr-1 text-slate-500" />
                Allot Remaining
              </Button>
            </Link>
          )}
        </div>
        <div className="p-0">
          {allotments.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-xs font-mono">
              <FactoryIcon className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p>No factory allotments made yet for this lot.</p>
              <Link href={`/lots/${lot.id}/allot`} className="mt-3 inline-block">
                <Button size="sm" className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs">
                  <Send className="w-3 h-3 mr-1.5 text-slate-300" />
                  Allot to Factory Floor Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-2xs uppercase font-bold text-slate-600 border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Challan Ref</th>
                    <th className="px-5 py-3">Factory Node</th>
                    <th className="px-5 py-3">Garment Items</th>
                    <th className="px-5 py-3 text-right">Job Rate</th>
                    <th className="px-5 py-3 text-right">Payable</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-center">Dispatch</th>
                    <th className="px-5 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allotments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold font-mono text-slate-900">
                        {a.challan_number}
                        <span className="block text-2xs text-slate-600 font-normal">
                          {formatDate(a.allotment_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {a.factory_name}
                        </span>
                        <span className="text-2xs text-slate-600 font-mono block">
                          {a.factory_is_own
                            ? 'In-House Unit'
                            : a.factory_linked
                            ? 'Linked Network Unit'
                            : 'Offline Partner'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-700">
                        {a.items.map((it, idx) => (
                          <span key={idx} className="block font-mono text-2xs">
                            • {it.work_type_name}: <b className="text-slate-900">{it.pieces.toLocaleString('en-IN')} pcs</b>
                          </span>
                        ))}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-700 text-xs">
                        ₹{a.rate_per_piece.toLocaleString('en-IN')} / pc
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(a.total_amount)}
                      </td>
                      {/* Interactive Status Toggle */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAllotmentStatus(a.id, a.status)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-2xs font-semibold font-mono transition-all ${
                            a.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title={
                            a.status === 'completed'
                              ? 'Click to reopen allotment'
                              : 'Click to mark complete'
                          }
                        >
                          {a.status === 'completed' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Completed
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-blue-600" />
                              In Progress
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {a.factory_phone ? (
                          <a
                            href={`https://wa.me/${a.factory_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Challan #${a.challan_number} for Lot #${lot.lot_number}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-2xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs gap-1"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Slip</span>
                          </a>
                        ) : (
                          <span className="text-2xs text-slate-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAllotment(a)}
                          className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 text-amber-700 border border-amber-200 rounded hover:bg-amber-50 transition-colors font-medium"
                          title="Unallot this factory challan and return pieces to pool"
                        >
                          <RotateCcw className="w-2.5 h-2.5 text-amber-600" />
                          Unallot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Special Remarks if any */}
      {lot.notes && (
        <Card className="shadow-xs border-gray-200">
          <CardHeader>
            <CardTitle className="text-sm">Special Instructions / Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
              {lot.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Lot Modal */}
      {businessId && (
        <EditLotModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          lotId={lot.id}
          businessId={businessId}
          onLotUpdated={loadLot}
        />
      )}
    </div>
  )
}
