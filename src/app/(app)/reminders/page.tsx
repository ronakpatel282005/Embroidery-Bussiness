'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Bell,
  Clock,
  AlertTriangle,
  MessageCircle,
  Phone,
  Package,
  Users,
  Factory,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { DEMO_LOTS, DEMO_VEPARIS } from '@/lib/demoData'

interface OverdueLot {
  id: string
  lot_number: string
  vepari_name: string
  vepari_phone: string | null
  due_date: string
  total_pieces: number
  total_amount: number
  days_overdue: number
}

interface PaymentDueClient {
  id: string
  name: string
  phone: string | null
  outstanding: number
}

interface PendingFactoryAllotment {
  id: string
  challan_number: string
  factory_name: string
  factory_phone: string | null
  allotment_date: string
  pieces: number
  total_amount: number
  days_in_production: number
}

export default function RemindersPage() {
  const supabase = createClient()

  const [overdueLots, setOverdueLots] = useState<OverdueLot[]>([])
  const [paymentDues, setPaymentDues] = useState<PaymentDueClient[]>([])
  const [factoryFollowups, setFactoryFollowups] = useState<PendingFactoryAllotment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'deliveries' | 'payments' | 'factories'>('deliveries')

  const loadReminders = useCallback(async () => {
    setLoading(true)

    const isDemo = typeof document !== 'undefined' && document.cookie.includes('demo_mode=true')

    let user = null
    let business = null
    try {
      const userRes = await supabase.auth.getUser()
      user = userRes.data?.user || null
      if (user) {
        const bizRes = await supabase
          .from('businesses')
          .select('id, name')
          .eq('user_id', user.id)
          .single()
        business = bizRes.data
      }
    } catch {
      // offline
    }

    if (isDemo || !user || !business) {
      const demoOverdue: OverdueLot[] = DEMO_LOTS.filter((l) => l.is_overdue).map((l) => ({
        id: l.id,
        lot_number: l.lot_number,
        vepari_name: l.vepari_name,
        vepari_phone: '9825123450',
        due_date: l.due_date,
        total_pieces: l.total_pieces,
        total_amount: l.total_amount,
        days_overdue: 3,
      }))
      const demoPayments: PaymentDueClient[] = DEMO_VEPARIS.filter((v) => v.balance > 0).map((v) => ({
        id: v.id,
        name: v.name,
        phone: v.phone,
        outstanding: v.balance,
      }))
      const demoFac: PendingFactoryAllotment[] = [
        {
          id: 'pfa-1',
          challan_number: 'CH-2401',
          factory_name: 'Maruti Embroidery Job Work',
          factory_phone: '9898012345',
          allotment_date: '2026-11-01',
          pieces: 480,
          total_amount: 31200,
          days_in_production: 2,
        },
      ]
      setOverdueLots(demoOverdue)
      setPaymentDues(demoPayments)
      setFactoryFollowups(demoFac)
      setLoading(false)
      return
    }

    const today = new Date()

    // 1. Overdue or upcoming lot delivery dates
    const { data: lotsData } = await supabase
      .from('lots')
      .select('id, lot_number, date, due_date, total_pieces, total_amount, status, veparis(name, phone)')
      .eq('business_id', business.id)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })

    const overdueList: OverdueLot[] = []
    ;(lotsData || []).forEach((l: any) => {
      if (l.due_date) {
        const dueDate = new Date(l.due_date)
        const diffTime = today.getTime() - dueDate.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Include if overdue or due in next 3 days
        if (diffDays >= -3) {
          overdueList.push({
            id: l.id,
            lot_number: l.lot_number,
            vepari_name: l.veparis?.name || 'Client',
            vepari_phone: l.veparis?.phone || null,
            due_date: l.due_date,
            total_pieces: l.total_pieces,
            total_amount: Number(l.total_amount) || 0,
            days_overdue: diffDays,
          })
        }
      }
    })
    setOverdueLots(overdueList)

    // 2. Clients with outstanding balances
    const [{ data: veparisList }, { data: vepLots }, { data: vepPays }] = await Promise.all([
      supabase.from('veparis').select('id, name, phone, opening_balance').eq('business_id', business.id),
      supabase.from('lots').select('vepari_id, total_amount').eq('business_id', business.id),
      supabase.from('vepari_payments').select('vepari_id, amount').eq('business_id', business.id),
    ])

    const clientDuesMap: Record<string, { id: string; name: string; phone: string | null; total: number; paid: number }> = {}
    ;(veparisList || []).forEach((v) => {
      clientDuesMap[v.id] = {
        id: v.id,
        name: v.name,
        phone: v.phone,
        total: Number(v.opening_balance || 0),
        paid: 0,
      }
    })

    ;(vepLots || []).forEach((l) => {
      if (l.vepari_id && clientDuesMap[l.vepari_id]) {
        clientDuesMap[l.vepari_id].total += Number(l.total_amount || 0)
      }
    })

    ;(vepPays || []).forEach((p) => {
      if (p.vepari_id && clientDuesMap[p.vepari_id]) {
        clientDuesMap[p.vepari_id].paid += Number(p.amount || 0)
      }
    })

    const highDues: PaymentDueClient[] = Object.values(clientDuesMap)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        outstanding: Math.max(0, c.total - c.paid),
      }))
      .filter((c) => c.outstanding >= 5000)
      .sort((a, b) => b.outstanding - a.outstanding)

    setPaymentDues(highDues)

    // 3. Factory outward challans pending > 5 days
    const { data: allotsData } = await supabase
      .from('lot_allotments')
      .select('id, challan_number, allotment_date, total_amount, status, factories(name, phone, is_own), allotment_items(pieces)')
      .eq('business_id', business.id)
      .neq('status', 'completed')
      .order('allotment_date', { ascending: true })

    const factoryList: PendingFactoryAllotment[] = []
    ;(allotsData || []).forEach((a: any) => {
      if (!a.factories?.is_own && a.allotment_date) {
        const allotDate = new Date(a.allotment_date)
        const diffTime = today.getTime() - allotDate.getTime()
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        const pcs = (a.allotment_items || []).reduce((max: number, it: any) => Math.max(max, it.pieces || 0), 0)

        factoryList.push({
          id: a.id,
          challan_number: a.challan_number,
          factory_name: a.factories?.name || 'Partner Factory',
          factory_phone: a.factories?.phone || null,
          allotment_date: a.allotment_date,
          pieces: pcs,
          total_amount: Number(a.total_amount) || 0,
          days_in_production: days,
        })
      }
    })

    setFactoryFollowups(factoryList)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xs uppercase tracking-wider font-mono font-bold text-slate-400">
              Operations Control
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-3xs uppercase tracking-wider font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Production Alerts
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-slate-700" />
            Reminders & Follow-ups
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated alerts for delivery dates, high client payment balances, and factory turnaround.
          </p>
        </div>

        <Button onClick={loadReminders} variant="outline" size="sm" className="shadow-2xs h-8 text-xs font-medium">
          Refresh Alerts
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('deliveries')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'deliveries'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-slate-700" />
          <span>Delivery Deadlines</span>
          <span className="px-2 py-0.5 rounded-full text-2xs font-mono bg-slate-100 text-slate-600 font-semibold">
            {overdueLots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'payments'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-slate-700" />
          <span>Payment Follow-ups</span>
          <span className="px-2 py-0.5 rounded-full text-2xs font-mono bg-slate-100 text-slate-600 font-semibold">
            {paymentDues.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('factories')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'factories'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Factory className="w-4 h-4 text-slate-700" />
          <span>Factory Turnaround</span>
          <span className="px-2 py-0.5 rounded-full text-2xs font-mono bg-slate-100 text-slate-600 font-semibold">
            {factoryFollowups.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          <div className="animate-spin h-7 w-7 border-2 border-slate-700 border-t-transparent rounded-full mx-auto mb-3" />
          Checking deadlines & reminders...
        </div>
      ) : activeTab === 'deliveries' ? (
        /* Tab 1: Delivery Deadlines */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Promised Delivery Dates</h3>
              <p className="text-2xs text-slate-500 mt-0.5">Orders nearing promised date or currently past due</p>
            </div>
            <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {overdueLots.filter((l) => l.days_overdue > 0).length} Overdue
            </span>
          </div>

          {overdueLots.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              All active orders are on schedule! No delivery delays.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-2xs uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Lot #</th>
                    <th className="px-5 py-3">Client (Vepari)</th>
                    <th className="px-5 py-3">Delivery Promised</th>
                    <th className="px-5 py-3 text-center">Pieces</th>
                    <th className="px-5 py-3 text-center">Urgency</th>
                    <th className="px-5 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueLots.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-900 font-mono text-xs">
                        <Link href={`/lots/${l.id}`} className="hover:underline">
                          #{l.lot_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 text-xs">{l.vepari_name}</td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-700">
                        {formatDate(l.due_date)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900">
                        {l.total_pieces} pcs
                      </td>
                      <td className="px-6 py-4 text-center">
                        {l.days_overdue > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            {l.days_overdue} days overdue
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Due in {Math.abs(l.days_overdue)} days
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/lots/${l.id}`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              View Lot
                            </Button>
                          </Link>
                          {l.vepari_phone && (
                            <a
                              href={`https://wa.me/91${l.vepari_phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                                `Hello ${l.vepari_name}, regarding your embroidery order #${l.lot_number} (${l.total_pieces} pcs). We are on track for delivery. Please let us know if any special packing is required.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Update client via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'payments' ? (
        /* Tab 2: Payment Follow-ups */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Clients with High Outstanding Balances</h3>
              <p className="text-xs text-gray-500">Clients with pending dues ≥ ₹5,000 ready for payment follow-up</p>
            </div>
          </div>

          {paymentDues.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              All client accounts are clear! No major pending balances.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Client / Vepari</th>
                    <th className="px-6 py-3.5 text-right">Balance Due (₹)</th>
                    <th className="px-6 py-3.5 text-center">Quick WhatsApp Reminder</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentDues.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{c.name}</p>
                        {c.phone && <p className="text-xs text-gray-400 font-mono">{c.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-lg text-amber-600">
                        {formatCurrency(c.outstanding)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {c.phone ? (
                          <a
                            href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                              `Pranam ${c.name} ji, gentle reminder regarding the current pending embroidery bill balance of ${formatCurrency(
                                c.outstanding
                              )}. Kindly arrange payment at your earliest convenience. Thank you!`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Send Payment Reminder
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No phone saved</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link href={`/veparis/${c.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            View Ledger &rarr;
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Tab 3: Factory Turnaround */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Outside Factory Challan Turnaround</h3>
              <p className="text-xs text-gray-500">Challans currently active with partner factories</p>
            </div>
          </div>

          {factoryFollowups.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              No pending outward factory challans.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Challan #</th>
                    <th className="px-6 py-3.5">Factory Unit</th>
                    <th className="px-6 py-3.5 text-center">Pieces</th>
                    <th className="px-6 py-3.5">Sent Date</th>
                    <th className="px-6 py-3.5 text-center">Time with Factory</th>
                    <th className="px-6 py-3.5 text-center">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {factoryFollowups.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">{f.challan_number}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{f.factory_name}</td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900">{f.pieces} pcs</td>
                      <td className="px-6 py-4 text-xs text-gray-600">{formatDate(f.allotment_date)}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            f.days_in_production >= 7
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {f.days_in_production} days on floor
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {f.factory_phone && (
                          <a
                            href={`https://wa.me/91${f.factory_phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                              `Hello ${f.factory_name}, checking on delivery status for Challan #${f.challan_number} (${f.pieces} pcs). Kindly update when pieces will be ready for pickup. Thank you!`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Check Status
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
      )}
    </div>
  )
}
