'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Users,
  Factory,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react'

interface VepariSummary {
  id: string
  name: string
  phone: string | null
  total_billed: number
  total_paid: number
  outstanding: number
}

interface FactorySummary {
  id: string
  name: string
  owner_name: string | null
  phone: string | null
  is_own: boolean
  total_cost: number
  total_paid: number
  balance_due: number
}

export default function ReportsAnalyticsPage() {
  const supabase = createClient()

  const [datePreset, setDatePreset] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>('this_month')
  const [loading, setLoading] = useState(true)

  // Aggregated data
  const [totalBilled, setTotalBilled] = useState(0)
  const [totalCollected, setTotalCollected] = useState(0)
  const [totalFactoryCost, setTotalFactoryCost] = useState(0)
  const [totalFactoryPaid, setTotalFactoryPaid] = useState(0)
  const [totalPieces, setTotalPieces] = useState(0)
  const [lotCount, setLotCount] = useState(0)

  // Tables
  const [vepariBreakdown, setVepariBreakdown] = useState<VepariSummary[]>([])
  const [factoryBreakdown, setFactoryBreakdown] = useState<FactorySummary[]>([])

  const loadReportData = useCallback(async () => {
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

    // Determine date range
    const now = new Date()
    let startDate: string | null = null
    let endDate: string | null = null

    if (datePreset === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    } else if (datePreset === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    } else if (datePreset === 'this_year') {
      startDate = `${now.getFullYear()}-01-01`
      endDate = `${now.getFullYear()}-12-31`
    }

    // 1. Fetch lots
    let lotsQuery = supabase
      .from('lots')
      .select('id, lot_number, date, total_amount, total_pieces, vepari_id, veparis(name, phone)')
      .eq('business_id', business.id)

    if (startDate && endDate) {
      lotsQuery = lotsQuery.gte('date', startDate).lte('date', endDate)
    }
    const { data: lotsData } = await lotsQuery

    // 2. Fetch vepari payments
    let payQuery = supabase
      .from('vepari_payments')
      .select('id, amount, payment_date, vepari_id')
      .eq('business_id', business.id)

    if (startDate && endDate) {
      payQuery = payQuery.gte('payment_date', startDate).lte('payment_date', endDate)
    }
    const { data: paymentsData } = await payQuery

    // 3. Fetch veparis master
    const { data: veparisList } = await supabase
      .from('veparis')
      .select('id, name, phone, opening_balance')
      .eq('business_id', business.id)

    // 4. Fetch outward factory allotments
    let allotQuery = supabase
      .from('lot_allotments')
      .select('id, factory_id, total_amount, allotment_date, factories(id, name, owner_name, phone, is_own)')
      .eq('business_id', business.id)

    if (startDate && endDate) {
      allotQuery = allotQuery.gte('allotment_date', startDate).lte('allotment_date', endDate)
    }
    const { data: allotsData } = await allotQuery

    // 5. Fetch factory payments
    let facPayQuery = supabase
      .from('factory_payments')
      .select('id, factory_id, amount, payment_date')
      .eq('business_id', business.id)

    if (startDate && endDate) {
      facPayQuery = facPayQuery.gte('payment_date', startDate).lte('payment_date', endDate)
    }
    const { data: facPaysData } = await facPayQuery

    // Calculate totals
    const billedSum = (lotsData || []).reduce((sum, l) => sum + Number(l.total_amount || 0), 0)
    const piecesSum = (lotsData || []).reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)
    const collectedSum = (paymentsData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const externalAllots = (allotsData || []).filter((a: any) => !a.factories?.is_own)
    const facCostSum = externalAllots.reduce((sum, a: any) => sum + Number(a.total_amount || 0), 0)
    const facPaidSum = (facPaysData || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0)

    setTotalBilled(billedSum)
    setTotalPieces(piecesSum)
    setLotCount((lotsData || []).length)
    setTotalCollected(collectedSum)
    setTotalFactoryCost(facCostSum)
    setTotalFactoryPaid(facPaidSum)

    // Build Vepari breakdown
    const vepMap: Record<string, VepariSummary> = {}
    ;(veparisList || []).forEach((v) => {
      vepMap[v.id] = {
        id: v.id,
        name: v.name,
        phone: v.phone,
        total_billed: Number(v.opening_balance || 0),
        total_paid: 0,
        outstanding: Number(v.opening_balance || 0),
      }
    })

    ;(lotsData || []).forEach((l) => {
      if (l.vepari_id && vepMap[l.vepari_id]) {
        vepMap[l.vepari_id].total_billed += Number(l.total_amount || 0)
      }
    })

    ;(paymentsData || []).forEach((p) => {
      if (p.vepari_id && vepMap[p.vepari_id]) {
        vepMap[p.vepari_id].total_paid += Number(p.amount || 0)
      }
    })

    const vepSummaryList = Object.values(vepMap).map((v) => ({
      ...v,
      outstanding: Math.max(0, v.total_billed - v.total_paid),
    }))
    setVepariBreakdown(vepSummaryList.filter((v) => v.total_billed > 0 || v.total_paid > 0))

    // Build Factory breakdown
    const facMap: Record<string, FactorySummary> = {}
    externalAllots.forEach((a: any) => {
      const f = a.factories
      if (!f) return
      if (!facMap[f.id]) {
        facMap[f.id] = {
          id: f.id,
          name: f.name,
          owner_name: f.owner_name,
          phone: f.phone,
          is_own: Boolean(f.is_own),
          total_cost: 0,
          total_paid: 0,
          balance_due: 0,
        }
      }
      facMap[f.id].total_cost += Number(a.total_amount || 0)
    })

    ;(facPaysData || []).forEach((p: any) => {
      if (facMap[p.factory_id]) {
        facMap[p.factory_id].total_paid += Number(p.amount || 0)
      }
    })

    const facSummaryList = Object.values(facMap).map((f) => ({
      ...f,
      balance_due: Math.max(0, f.total_cost - f.total_paid),
    }))
    setFactoryBreakdown(facSummaryList)

    setLoading(false)
  }, [datePreset, supabase])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  // CSV Export
  const handleExportCSV = () => {
    const rows = [
      ['Vepari (Client)', 'Phone', 'Total Billed (Rs)', 'Total Paid (Rs)', 'Outstanding Due (Rs)'],
      ...vepariBreakdown.map((v) => [v.name, v.phone || '', v.total_billed, v.total_paid, v.outstanding]),
      [],
      ['Factory (Outsourced)', 'Owner', 'Phone', 'Total Cost (Rs)', 'Total Paid (Rs)', 'Balance Due (Rs)'],
      ...factoryBreakdown.map((f) => [f.name, f.owner_name || '', f.phone || '', f.total_cost, f.total_paid, f.balance_due]),
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Embroidery_Business_Report_${datePreset}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const netOutstandingReceivable = Math.max(0, totalBilled - totalCollected)
  const netPayableToFactories = Math.max(0, totalFactoryCost - totalFactoryPaid)
  const grossMargin = totalBilled - totalFactoryCost

  return (
    <div className="p-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Financial & Production Reports
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Overview of order billing, client receivables, factory expenses, and gross margins.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9">
            <Printer className="w-4 h-4 mr-1.5" />
            Print Report
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 shadow-xs"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase">Period:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDatePreset('this_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              datePreset === 'this_month'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('last_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              datePreset === 'last_month'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Last Month
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('this_year')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              datePreset === 'this_year'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            This Year (2026)
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              datePreset === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Financial Health KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders Billed</p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-indigo-700 font-mono">
            {formatCurrency(totalBilled)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {totalPieces.toLocaleString('en-IN')} pcs across {lotCount} lots
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Outstanding Due</p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600 font-mono">
            {formatCurrency(netOutstandingReceivable)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Collected {formatCurrency(totalCollected)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Factory Payable Due</p>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-orange-600 font-mono">
            {formatCurrency(netPayableToFactories)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Paid {formatCurrency(totalFactoryPaid)} / Total {formatCurrency(totalFactoryCost)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Profit Margin</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-700 font-mono">
            {formatCurrency(grossMargin)}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            {totalBilled > 0 ? `${Math.round((grossMargin / totalBilled) * 100)}% margin spread` : '—'}
          </p>
        </div>
      </div>

      {/* Section 1: Client / Vepari Receivables Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs mb-8 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Client / Vepari Statement Summary
            </h2>
            <p className="text-xs text-gray-500">Breakdown of orders billed, payments collected, and dues pending</p>
          </div>
          <span className="text-xs text-gray-400">{vepariBreakdown.length} clients</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
            Loading client figures...
          </div>
        ) : vepariBreakdown.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No active billing recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">Client / Vepari</th>
                  <th className="px-6 py-3.5 text-right">Total Billed (₹)</th>
                  <th className="px-6 py-3.5 text-right">Collected (₹)</th>
                  <th className="px-6 py-3.5 text-right">Outstanding (₹)</th>
                  <th className="px-6 py-3.5 text-center">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vepariBreakdown.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-900">{v.name}</td>
                    <td className="px-6 py-3.5 text-right font-mono text-gray-700">
                      {formatCurrency(v.total_billed)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(v.total_paid)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-amber-600">
                      {formatCurrency(v.outstanding)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {v.phone && (
                        <a
                          href={`https://wa.me/91${v.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                            `Hello ${v.name}, this is an account statement summary from our embroidery unit. Current balance due: ${formatCurrency(
                              v.outstanding
                            )}. Thank you!`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"
                        >
                          WhatsApp Statement
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Factory Allotment Expense Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-indigo-600" />
              Partner Factory Expenses & Payables
            </h2>
            <p className="text-xs text-gray-500">Summary of outward work cost and outstanding payments owed</p>
          </div>
          <span className="text-xs text-gray-400">{factoryBreakdown.length} units</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
            Loading factory expenses...
          </div>
        ) : factoryBreakdown.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No outside factory allotments recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5">Factory Unit</th>
                  <th className="px-6 py-3.5 text-right">Outward Cost (₹)</th>
                  <th className="px-6 py-3.5 text-right">Paid (₹)</th>
                  <th className="px-6 py-3.5 text-right">Balance Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {factoryBreakdown.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-gray-900">{f.name}</p>
                      {f.owner_name && <p className="text-xs text-gray-400">{f.owner_name}</p>}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-gray-700">
                      {formatCurrency(f.total_cost)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(f.total_paid)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-orange-600">
                      {formatCurrency(f.balance_due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
