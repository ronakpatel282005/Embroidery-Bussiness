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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Ledger & Audit</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-medium">Business Performance</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Financial & Production Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive audit of billing, trader collections, outsourced manufacturing expenses, and gross margins.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Print Statement
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
            Export CSV Ledger
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider">Accounting Period:</span>
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-lg gap-1">
          <button
            type="button"
            onClick={() => setDatePreset('this_month')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              datePreset === 'this_month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('last_month')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              datePreset === 'last_month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Last Month
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('this_year')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              datePreset === 'this_year'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Year (2026)
          </button>
          <button
            type="button"
            onClick={() => setDatePreset('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              datePreset === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* Unified Executive Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-600">Total Orders Billed</span>
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {formatCurrency(totalBilled)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-2xs text-slate-600 font-mono">
            <span>{totalPieces.toLocaleString('en-IN')} pcs</span>
            <span>•</span>
            <span>{lotCount} lots</span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-600">Receivables Due</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-amber-600 mt-2">
            {formatCurrency(netOutstandingReceivable)}
          </p>
          <p className="text-2xs text-slate-600 mt-1 font-mono">
            Collected: {formatCurrency(totalCollected)}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-600">Factory Payables</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {formatCurrency(netPayableToFactories)}
          </p>
          <p className="text-2xs text-slate-600 mt-1 font-mono">
            Paid {formatCurrency(totalFactoryPaid)} / Total {formatCurrency(totalFactoryCost)}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-600">Gross Margin Spread</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-2">
            {formatCurrency(grossMargin)}
          </p>
          <p className="text-2xs text-emerald-600 mt-1 font-semibold">
            {totalBilled > 0 ? `${Math.round((grossMargin / totalBilled) * 100)}% operating margin` : '—'}
          </p>
        </div>
      </div>

      {/* Section 1: Client / Vepari Receivables Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Client / Vepari Statement Summary
            </h2>
            <p className="text-2xs text-slate-600 mt-0.5">Orders billed, collections realized, and net balances</p>
          </div>
          <span className="text-2xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{vepariBreakdown.length} accounts</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="animate-spin h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full mx-auto mb-2" />
            Compiling audit statement...
          </div>
        ) : vepariBreakdown.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-xs font-mono">
            No active billing recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-2xs uppercase font-bold text-slate-600 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Client Name</th>
                  <th className="px-5 py-3 text-right">Total Billed</th>
                  <th className="px-5 py-3 text-right">Collected</th>
                  <th className="px-5 py-3 text-right">Outstanding</th>
                  <th className="px-5 py-3 text-center">Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vepariBreakdown.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">{v.name}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {formatCurrency(v.total_billed)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(v.total_paid)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-amber-600">
                      {formatCurrency(v.outstanding)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {v.phone && (
                        <a
                          href={`https://wa.me/91${v.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                            `Hello ${v.name}, this is an account statement summary from our embroidery unit. Current balance due: ${formatCurrency(
                              v.outstanding
                            )}. Thank you!`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-2xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shadow-2xs"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Factory className="w-3.5 h-3.5 text-slate-500" />
              Partner Factory Expenses & Payables
            </h2>
            <p className="text-2xs text-slate-600 mt-0.5">Outward work allotments, disbursements, and liabilities owed</p>
          </div>
          <span className="text-2xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{factoryBreakdown.length} units</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="animate-spin h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full mx-auto mb-2" />
            Loading factory expenses...
          </div>
        ) : factoryBreakdown.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-xs font-mono">
            No outside factory allotments recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-2xs uppercase font-bold text-slate-600 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Factory Unit</th>
                  <th className="px-5 py-3 text-right">Outward Cost</th>
                  <th className="px-5 py-3 text-right">Disbursed</th>
                  <th className="px-5 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factoryBreakdown.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{f.name}</p>
                      {f.owner_name && <p className="text-2xs text-slate-600">{f.owner_name}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {formatCurrency(f.total_cost)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(f.total_paid)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
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
