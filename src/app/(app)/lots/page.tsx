'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate, formatIndianNumber } from '@/lib/utils'
import {
  Package,
  Plus,
  Search,
  AlertCircle,
  Layers,
  ArrowRight,
  Edit2,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  RotateCcw,
  Building2,
  Inbox,
} from 'lucide-react'
import EditLotModal from '@/components/lots/EditLotModal'

interface LotItemSummary {
  work_type_name: string
  pieces: number
  allotted_pieces: number
}

export interface AssignedJobItem {
  id: string
  lot_id: string
  challan_number: string
  parent_lot_number: string
  client_name?: string
  source_type: 'in_house' | 'partner_job'
  source_name: string
  date: string
  due_date: string | null
  garment_parts: string[]
  pieces: number
  amount: number
  status: string
  is_allotment: boolean
  allotment_id?: string
}

interface UnifiedLotRow {
  id: string
  lot_number: string
  vepari_id?: string | null
  vepari_name: string
  is_partner_job: boolean
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
  items: LotItemSummary[]
  allotment_status: 'not_allotted' | 'partially_allotted' | 'allotted' | 'completed'
  is_assigned_to_self: boolean
  assigned_factory_names: string[]
}

export default function LotsDirectoryPage() {
  const [lots, setLots] = useState<UnifiedLotRow[]>([])
  const [assignedJobs, setAssignedJobs] = useState<AssignedJobItem[]>([])
  const [activeTab, setActiveTab] = useState<'my_lots' | 'jobs_assigned'>('my_lots')
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_allotted' | 'partially_allotted' | 'allotted' | 'completed'>('all')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [editLotId, setEditLotId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const supabase = createClient()

  const loadLots = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      setLoading(false)
      return
    }
    setBusinessId(business.id)

    // 1. Fetch all lots belonging to this business (both direct vepari lots and lots received from other factories)
    const { data: lotsData } = await supabase
      .from('lots')
      .select(`
        *,
        veparis(id, name),
        origin_allotment:lot_allotments!origin_allotment_id (
          id, challan_number, rate_per_piece, total_amount,
          allotment_items (pieces, work_type_name, rate, amount)
        )
      `)
      .eq('business_id', business.id)
      .order('date', { ascending: false })

    if (lotsData && lotsData.length > 0) {
      // 2. Fetch lot items
      const { data: itemsData } = await supabase
        .from('lot_items')
        .select('lot_id, work_type_name, pieces, allotted_pieces')
        .eq('business_id', business.id)

      const itemsByLot: Record<string, LotItemSummary[]> = {}
      itemsData?.forEach((item) => {
        if (!itemsByLot[item.lot_id]) itemsByLot[item.lot_id] = []
        itemsByLot[item.lot_id].push({
          work_type_name: item.work_type_name,
          pieces: item.pieces,
          allotted_pieces: item.allotted_pieces || 0,
        })
      })

      // 3. Fetch all allotments and their items to accurately calculate total allotted pieces
      const { data: allotmentsData } = await supabase
        .from('lot_allotments')
        .select(`
          id, lot_id, status, challan_number, allotment_date,
          pricing_type, rate_per_piece, total_amount,
          factories(id, name, is_own),
          allotment_items(work_type_name, pieces, rate, amount)
        `)
        .eq('business_id', business.id)

      const allotmentsByLot: Record<string, any[]> = {}
      allotmentsData?.forEach((a: any) => {
        if (!allotmentsByLot[a.lot_id]) allotmentsByLot[a.lot_id] = []
        allotmentsByLot[a.lot_id].push(a)
      })

      const formattedLots: UnifiedLotRow[] = lotsData.map((l: any) => {
        const lotItems = itemsByLot[l.id] || []
        const lotAllots = allotmentsByLot[l.id] || []

        // True if allotted to myself / in-house own factory unit
        const isAssignedToSelf = lotAllots.some((a: any) => a.factories?.is_own === true)
        const assignedFactoryNames = lotAllots
          .map((a: any) => (a.factories?.is_own ? 'Own Factory' : a.factories?.name))
          .filter(Boolean)

        const originPieces = (l.origin_allotment?.allotment_items || []).reduce(
          (max: number, ai: any) => Math.max(max, ai.pieces || 0),
          0
        )
        // Max pieces across parts: e.g. for a 40-suit lot (40 bottom, 40 dupatta, 40 plazo), maxPartPieces is 40!
        const maxPartPieces = lotItems.reduce((max: number, it: LotItemSummary) => Math.max(max, it.pieces || 0), 0)
        const isSummedPieces =
          lotItems.length > 1 &&
          maxPartPieces > 0 &&
          l.total_pieces === lotItems.reduce((sum: number, it: LotItemSummary) => sum + (it.pieces || 0), 0)

        // If this is an incoming partner job (e.g. 40 pcs allotted to Shree Krishna), total lot size is 40 pcs!
        const normalizedPieces = l.origin_allotment_id
          ? (originPieces || (maxPartPieces !== 240 && maxPartPieces > 0 ? maxPartPieces : 0) || l.total_pieces || 0)
          : (isSummedPieces ? maxPartPieces : (l.total_pieces || maxPartPieces || 0))

        if (l.origin_allotment_id && originPieces > 0 && l.total_pieces !== originPieces) {
          supabase.from('lots').update({ total_pieces: originPieces }).eq('id', l.id).then()
          if (itemsByLot[l.id]) {
            itemsByLot[l.id].forEach((it: any) => {
              if (it.pieces !== originPieces) {
                supabase.from('lot_items').update({ pieces: originPieces }).eq('lot_id', l.id).then()
              }
            })
          }
        }

        // Calculate total allotted pieces across all outward allotments for this lot
        const partAllottedSums: Record<string, number> = {}
        lotAllots.forEach((a: any) => {
          (a.allotment_items || []).forEach((ai: any) => {
            const partName = ai.work_type_name || 'default'
            partAllottedSums[partName] = (partAllottedSums[partName] || 0) + (ai.pieces || 0)
          })
        })
        const maxAllotmentItemPieces = Object.values(partAllottedSums).length > 0
          ? Object.values(partAllottedSums).reduce((max, val) => Math.max(max, val), 0)
          : 0

        const maxItemAllotted = lotItems.reduce((max: number, it: LotItemSummary) => Math.max(max, it.allotted_pieces || 0), 0)
        const effectiveAllottedPieces = Math.max(maxAllotmentItemPieces, maxItemAllotted)

        let allotmentStatus: 'not_allotted' | 'partially_allotted' | 'allotted' | 'completed' = 'not_allotted'
        if (l.status === 'completed') {
          allotmentStatus = 'completed'
        } else if (effectiveAllottedPieces >= normalizedPieces && normalizedPieces > 0) {
          allotmentStatus = 'allotted'
        } else if (effectiveAllottedPieces > 0) {
          allotmentStatus = 'partially_allotted'
        } else {
          allotmentStatus = 'not_allotted'
        }

        return {
          id: l.id,
          lot_number: l.lot_number,
          vepari_id: l.vepari_id,
          vepari_name: l.veparis?.name || 'Unknown Vepari',
          is_partner_job: Boolean(l.origin_allotment_id),
          origin_allotment_id: l.origin_allotment_id,
          date: l.date,
          due_date: l.due_date,
          design_number: l.design_number,
          description: l.description,
          pricing_type: l.pricing_type,
          total_pieces: normalizedPieces,
          allotted_pieces: effectiveAllottedPieces,
          total_amount: Number(l.total_amount) || 0,
          status: l.status,
          items: lotItems,
          allotment_status: allotmentStatus,
          is_assigned_to_self: isAssignedToSelf,
          assigned_factory_names: assignedFactoryNames,
        }
      })

      // 4. Build Assigned Jobs List: strictly in-house machine floor allotments
      const inHouseJobs: AssignedJobItem[] = []
      allotmentsData?.forEach((a: any) => {
        if (a.factories?.is_own === true) {
          const parentLot = lotsData.find((l: any) => l.id === a.lot_id)
          const partPieces = (a.allotment_items || []).reduce(
            (max: number, ai: any) => Math.max(max, ai.pieces || 0),
            0
          )
          const parts = (a.allotment_items || []).map((ai: any) => ai.work_type_name).filter(Boolean)

          inHouseJobs.push({
            id: a.id,
            lot_id: a.lot_id,
            allotment_id: a.id,
            challan_number: a.challan_number,
            parent_lot_number: parentLot?.lot_number || 'Unknown Lot',
            client_name: (parentLot?.veparis as any)?.name || 'Direct Vepari',
            source_type: 'in_house',
            source_name: a.factories?.name || business.name || 'In-House Unit',
            date: a.allotment_date || parentLot?.date || new Date().toISOString().split('T')[0],
            due_date: parentLot?.due_date || null,
            garment_parts: parts.length > 0 ? parts : ['Full Suit'],
            pieces: partPieces || parentLot?.total_pieces || 0,
            amount: Number(a.total_amount) || 0,
            status: a.status || 'sent',
            is_allotment: true,
          })
        }
      })

      setLots(formattedLots)
      setAssignedJobs(inHouseJobs)
    } else {
      setLots([])
      setAssignedJobs([])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadLots()
  }, [loadLots])

  const handleDeleteLot = async (lot: UnifiedLotRow) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Lot "${lot.lot_number}"?\n\nThis will permanently delete this lot and its outward factory allotments.`
    )
    if (!confirmed) return

    const { error: delErr } = await supabase.from('lots').delete().eq('id', lot.id)
    if (delErr) {
      alert(`Failed to delete lot: ${delErr.message}`)
    } else {
      loadLots()
    }
  }

  // Unallot: Cancels factory allotment, resets pieces to available, and sets lot back to Not Allotted
  const handleUnallotLot = async (lot: UnifiedLotRow) => {
    const confirmed = window.confirm(
      `Unallot Lot "${lot.lot_number}"?\n\nThis will cancel the outward factory allotment and return all ${lot.total_pieces} pieces to "Not Allotted" so you can freshly re-allot them.`
    )
    if (!confirmed) return

    // 1. Delete all outward allotments for this lot (cascades to partner mirrored lot)
    const { error: allotErr } = await supabase
      .from('lot_allotments')
      .delete()
      .eq('lot_id', lot.id)

    if (allotErr) {
      alert(`Could not unallot: ${allotErr.message}`)
      return
    }

    // 2. Reset allotted_pieces on lot_items
    await supabase
      .from('lot_items')
      .update({ allotted_pieces: 0 })
      .eq('lot_id', lot.id)

    // 3. Reset lot status to 'received'
    await supabase
      .from('lots')
      .update({ status: 'received' })
      .eq('id', lot.id)

    loadLots()
  }

  // Toggle Status for In-House Allotment
  const handleToggleAllotmentStatus = async (allotmentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'in_progress' : 'completed'
    const { error } = await supabase
      .from('lot_allotments')
      .update({ status: nextStatus })
      .eq('id', allotmentId)

    if (error) {
      alert(`Failed to update status: ${error.message}`)
    } else {
      loadLots()
    }
  }

  // Unallot a single in-house allotment
  const handleUnallotJob = async (job: AssignedJobItem) => {
    if (!job.allotment_id) return
    const confirmed = window.confirm(
      `Unallot in-house challan "${job.challan_number}" (${job.pieces} pcs)?\n\nThis will remove this in-house allotment and return ${job.pieces} pcs back to "Not Allotted".`
    )
    if (!confirmed) return

    const { error: allotErr } = await supabase
      .from('lot_allotments')
      .delete()
      .eq('id', job.allotment_id)

    if (allotErr) {
      alert(`Could not unallot: ${allotErr.message}`)
      return
    }

    const { data: items } = await supabase
      .from('lot_items')
      .select('id, allotted_pieces')
      .eq('lot_id', job.lot_id)

    if (items) {
      for (const it of items) {
        const updated = Math.max(0, (it.allotted_pieces || 0) - job.pieces)
        await supabase.from('lot_items').update({ allotted_pieces: updated }).eq('id', it.id)
      }
    }

    const { count } = await supabase
      .from('lot_allotments')
      .select('id', { count: 'exact', head: true })
      .eq('lot_id', job.lot_id)

    if (!count || count === 0) {
      await supabase.from('lots').update({ status: 'received' }).eq('id', job.lot_id)
    }

    loadLots()
  }

  // Filter within active tab
  const filteredLots = lots.filter((lot) => {
    const q = search.toLowerCase()
    const matchesSearch =
      lot.lot_number.toLowerCase().includes(q) ||
      lot.vepari_name.toLowerCase().includes(q) ||
      (lot.design_number && lot.design_number.toLowerCase().includes(q)) ||
      (lot.description && lot.description.toLowerCase().includes(q))

    const matchesStatus =
      statusFilter === 'all' || lot.allotment_status === statusFilter

    return matchesSearch && matchesStatus
  })

  const filteredJobs = assignedJobs.filter((job) => {
    const q = search.toLowerCase()
    const matchesSearch =
      job.challan_number.toLowerCase().includes(q) ||
      job.parent_lot_number.toLowerCase().includes(q) ||
      job.source_name.toLowerCase().includes(q) ||
      (job.client_name && job.client_name.toLowerCase().includes(q))

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' ? job.status === 'completed' : job.status !== 'completed')

    return matchesSearch && matchesStatus
  })

  // Allotment Status Counts for Lots
  const notAllottedCount = lots.filter((l) => l.allotment_status === 'not_allotted').length
  const allottedCount = lots.filter((l) => l.allotment_status === 'allotted').length
  const completedCount = lots.filter((l) => l.allotment_status === 'completed').length

  // Counts for Assigned Jobs
  const jobsInProdCount = assignedJobs.filter((j) => j.status !== 'completed').length
  const jobsCompletedCount = assignedJobs.filter((j) => j.status === 'completed').length

  // KPIs for active tab
  const totalPiecesCount =
    activeTab === 'my_lots'
      ? filteredLots.reduce((sum, l) => sum + l.total_pieces, 0)
      : filteredJobs.reduce((sum, j) => sum + j.pieces, 0)

  const totalLotsValue =
    activeTab === 'my_lots'
      ? filteredLots.reduce((sum, l) => sum + l.total_amount, 0)
      : filteredJobs.reduce((sum, j) => sum + j.amount, 0)

  const overdueCount =
    activeTab === 'my_lots'
      ? filteredLots.filter(
          (l) => l.due_date && new Date(l.due_date) < new Date() && l.status !== 'completed'
        ).length
      : filteredJobs.filter(
          (j) => j.due_date && new Date(j.due_date) < new Date() && j.status !== 'completed'
        ).length

  return (
    <div className="p-8 max-w-7xl">
      {/* Top Primary Tabs matching User Design */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab('my_lots')
            setStatusFilter('all')
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
            activeTab === 'my_lots'
              ? 'bg-white text-indigo-700 border-2 border-indigo-400 font-bold shadow-xs'
              : 'text-gray-500 hover:text-gray-900 font-medium hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4 text-indigo-600" />
          <span>My Lots ({lots.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('jobs_assigned')
            setStatusFilter('all')
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
            activeTab === 'jobs_assigned'
              ? 'bg-white text-indigo-700 border-2 border-indigo-400 font-bold shadow-xs'
              : 'text-gray-500 hover:text-gray-900 font-medium hover:bg-gray-100'
          }`}
        >
          <Inbox className="w-4 h-4 text-indigo-600" />
          <span>Jobs Assigned to Us ({assignedJobs.length})</span>
        </button>
      </div>

      {/* Header based on active tab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {activeTab === 'my_lots' ? (
              <>
                <Package className="w-6 h-6 text-indigo-600" />
                Lots Directory
              </>
            ) : (
              <>
                <Inbox className="w-6 h-6 text-indigo-600" />
                Jobs Assigned to Us (Own Floor)
              </>
            )}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {activeTab === 'my_lots'
              ? 'Complete list of all embroidery lots and client orders.'
              : 'Production floor assignments: Lots and pieces allotted to your own in-house machines to manufacture.'}
          </p>
        </div>
        {activeTab === 'my_lots' && (
          <div>
            <Link href="/lots/new">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 shadow-xs">
                <Plus className="w-4 h-4 mr-2" />
                Add New Lot
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {activeTab === 'my_lots' ? 'Total Lots' : 'Assigned Jobs'}
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              {activeTab === 'my_lots' ? <Package className="w-5 h-5" /> : <Inbox className="w-5 h-5" />}
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {activeTab === 'my_lots' ? filteredLots.length : filteredJobs.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'my_lots'
              ? `${notAllottedCount} not allotted • ${allottedCount} allotted`
              : `${jobsInProdCount} in production • ${jobsCompletedCount} completed`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Pieces</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{formatIndianNumber(totalPiecesCount)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'my_lots' ? 'Pieces across current lots' : 'Pieces assigned to factory floor'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {activeTab === 'my_lots' ? 'Total Receivable' : 'Factory Earnings'}
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <span className="font-bold text-sm">₹</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
            {formatCurrency(totalLotsValue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'my_lots' ? 'Amount receivable from veparis' : 'Receivable from client designers / in-house'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Overdue Delivery</p>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              overdueCount > 0 ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {overdueCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">Past due delivery date</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs mb-6 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={
                activeTab === 'my_lots'
                  ? 'Search by lot number, vepari name, or design...'
                  : 'Search by challan number, client name, or design...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-medium">
            {activeTab === 'my_lots' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Status ({lots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('not_allotted')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'not_allotted'
                      ? 'bg-white text-amber-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Not Allotted ({notAllottedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('allotted')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'allotted'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Allotted ({allottedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed ({completedCount})
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Jobs ({assignedJobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('not_allotted')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'not_allotted'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  In Production ({jobsInProdCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed ({jobsCompletedCount})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Lots or Assigned Jobs List */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading...
          </div>
        ) : (activeTab === 'my_lots' ? filteredLots.length === 0 : filteredJobs.length === 0) ? (
          activeTab === 'jobs_assigned' ? (
            <div className="py-16 text-center text-gray-500">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-800">No Jobs Assigned to You Yet</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mt-1 mb-4">
                When work is allotted to your in-house factory floor or sent to you by a partner designer, it will appear here.
              </p>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500">
              <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-800">No Lots Found</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                {search
                  ? 'No lots match your search query.'
                  : 'No lots recorded yet. Click below to add your first lot.'}
              </p>
              {!search && (
                <Link href="/lots/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add New Lot
                  </Button>
                </Link>
              )}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">
                    {activeTab === 'my_lots' ? 'Lot #' : 'Challan / Lot #'}
                  </th>
                  <th className="px-6 py-3.5">
                    {activeTab === 'my_lots' ? 'Vepari (Client)' : 'Assigned From'}
                  </th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Garment Parts</th>
                  <th className="px-6 py-3.5 text-center">Pieces</th>
                  <th className="px-6 py-3.5 text-right">
                    {activeTab === 'my_lots' ? 'Amount (₹)' : 'Value / Earnings'}
                  </th>
                  <th className="px-6 py-3.5 text-center">
                    {activeTab === 'my_lots' ? 'Allotment Status' : 'Live Status'}
                  </th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeTab === 'jobs_assigned'
                  ? filteredJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50/75 transition-colors">
                        {/* Challan / Lot # */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/lots/${job.lot_id}`}
                              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                            >
                              <span>{job.challan_number}</span>
                              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                            </Link>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs"
                              title="In-House assignment to your own machines"
                            >
                              <Building2 className="w-3 h-3 text-purple-600" />
                              In-House Floor
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">From Lot #{job.parent_lot_number}</p>
                        </td>

                        {/* Source / Client */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{job.source_name}</span>
                          <span className="text-2xs text-purple-700 font-medium block mt-0.5">
                            In-House Floor • Client: {job.client_name || 'Direct Vepari'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-xs text-gray-600">
                          <p>{formatDate(job.date)}</p>
                          {job.due_date && (
                            <p
                              className={
                                new Date(job.due_date) < new Date() && job.status !== 'completed'
                                  ? 'text-red-500 font-semibold'
                                  : 'text-gray-400'
                              }
                            >
                              Due: {formatDate(job.due_date)}
                            </p>
                          )}
                        </td>

                        {/* Garment Parts */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {job.garment_parts.map((p, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 font-medium"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Pieces */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-bold text-xs font-mono shadow-2xs">
                            {job.pieces.toLocaleString('en-IN')} pcs
                          </span>
                        </td>

                        {/* Amount / Rate */}
                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                          {job.amount > 0 ? formatCurrency(job.amount) : 'In-House (₹0)'}
                        </td>

                        {/* Live Status */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              job.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {job.status === 'completed' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Completed
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                In Production
                              </>
                            )}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link href={`/lots/${job.lot_id}`}>
                              <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                                View
                              </Button>
                            </Link>

                            {job.is_allotment && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleToggleAllotmentStatus(job.allotment_id!, job.status)}
                                  className={`h-8 text-xs px-2.5 shadow-xs ${
                                    job.status === 'completed'
                                      ? 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                  title="Mark complete / reopen in-house production"
                                >
                                  {job.status === 'completed' ? (
                                    <>
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reopen
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Mark Complete
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnallotJob(job)}
                                  className="h-8 text-xs px-2.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  title="Cancel in-house allotment and return pieces to unallotted"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                                  Unallot
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  : filteredLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-gray-50/75 transition-colors">
                        {/* Lot / Challan # */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/lots/${lot.id}`}
                              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                            >
                              <span>{lot.lot_number}</span>
                              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                            </Link>
                          </div>
                          {lot.design_number && (
                            <p className="text-xs text-gray-400 mt-0.5">Design: {lot.design_number}</p>
                          )}
                        </td>

                        {/* Vepari (Client) */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{lot.vepari_name}</span>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-xs text-gray-600">
                          <p>{formatDate(lot.date)}</p>
                          {lot.due_date && (
                            <p
                              className={
                                new Date(lot.due_date) < new Date() && lot.status !== 'completed'
                                  ? 'text-red-500 font-semibold'
                                  : 'text-gray-400'
                              }
                            >
                              Due: {formatDate(lot.due_date)}
                            </p>
                          )}
                        </td>

                        {/* Garment Parts */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {lot.items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 font-medium"
                              >
                                {it.work_type_name}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Pieces Count */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs font-mono shadow-2xs">
                            {lot.total_pieces.toLocaleString('en-IN')} pcs
                          </span>
                        </td>

                        {/* Total Amount */}
                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                          {formatCurrency(lot.total_amount)}
                        </td>

                        {/* Allotment Status: Not Allotted, Allotted, Completed */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              lot.allotment_status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lot.allotment_status === 'allotted'
                                ? 'bg-blue-100 text-blue-800'
                                : lot.allotment_status === 'partially_allotted'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {lot.allotment_status === 'completed' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Completed
                              </>
                            ) : lot.allotment_status === 'allotted' ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                Allotted ({lot.total_pieces} pcs)
                              </>
                            ) : lot.allotment_status === 'partially_allotted' ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-purple-600" />
                                Partially Allotted ({lot.allotted_pieces}/{lot.total_pieces} pcs)
                              </>
                            ) : (
                              <>
                                <Package className="w-3.5 h-3.5 text-amber-600" />
                                Not Allotted
                              </>
                            )}
                          </span>
                        </td>

                        {/* Actions: Supports split lots (e.g. 200 to Factory 1, 40 to Factory 2) */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link href={`/lots/${lot.id}`}>
                              <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                                View
                              </Button>
                            </Link>

                            {/* If Not Allotted: Show Allot button */}
                            {lot.allotment_status === 'not_allotted' && (
                              <Link href={`/lots/${lot.id}/allot`}>
                                <Button
                                  size="sm"
                                  className="h-8 text-xs px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                  title="Allot work to machines or external factories"
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Allot
                                </Button>
                              </Link>
                            )}

                            {/* If Partially Allotted: Show Allot More button for remaining pieces + Unallot */}
                            {lot.allotment_status === 'partially_allotted' && (
                              <>
                                <Link href={`/lots/${lot.id}/allot`}>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                    title={`Allot remaining ${lot.total_pieces - lot.allotted_pieces} pieces to another factory`}
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    Allot More ({lot.total_pieces - lot.allotted_pieces})
                                  </Button>
                                </Link>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnallotLot(lot)}
                                  className="h-8 text-xs px-2.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  title="Cancel all allotments and return pieces to unallotted"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                                  Unallot
                                </Button>
                              </>
                            )}

                            {/* If Fully Allotted: Show Unallot button to easily cancel and re-allot freshly! */}
                            {lot.allotment_status === 'allotted' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnallotLot(lot)}
                                className="h-8 text-xs px-2.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                                title="Unallot this lot and re-allot freshly"
                              >
                                <RotateCcw className="w-3 h-3 mr-1 text-amber-600" />
                                Unallot
                              </Button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditLotId(lot.id)
                                setIsEditModalOpen(true)
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                              title="Edit Lot"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteLot(lot)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                              title="Delete Lot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Lot Modal */}
      {businessId && editLotId && (
        <EditLotModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditLotId(null)
          }}
          lotId={editLotId}
          businessId={businessId}
          onLotUpdated={loadLots}
        />
      )}
    </div>
  )
}
