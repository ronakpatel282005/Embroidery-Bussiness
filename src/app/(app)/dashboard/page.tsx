import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import {
  PackagePlus,
  Users,
  Factory,
  UserCheck,
  ShoppingBag,
  Receipt,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/auth/login')

  // Fetch real statistics
  const [
    { data: veparisData },
    { data: lotsData },
    { data: paymentsData },
    { data: allotmentsData },
    { data: factoryPaymentsData },
  ] = await Promise.all([
    supabase.from('veparis').select('id, opening_balance').eq('business_id', business.id),
    supabase.from('lots').select('id, total_amount, due_date, status').eq('business_id', business.id),
    supabase.from('vepari_payments').select('amount').eq('business_id', business.id),
    supabase.from('lot_allotments').select('total_amount, factories(is_own)').eq('business_id', business.id),
    supabase.from('factory_payments').select('amount').eq('business_id', business.id),
  ])

  // Receivables from Veparis
  const totalOpening = (veparisData || []).reduce((sum, v) => sum + Number(v.opening_balance || 0), 0)
  const totalLotsAmount = (lotsData || []).reduce((sum, l) => sum + Number(l.total_amount || 0), 0)
  const totalPayments = (paymentsData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalReceivable = Math.max(0, totalOpening + totalLotsAmount - totalPayments)

  // Payables to External Partner Factories
  const totalAllotmentCost = (allotmentsData || [])
    .filter((a: any) => !a.factories?.is_own)
    .reduce((sum, a: any) => sum + Number(a.total_amount || 0), 0)
  const totalFactoryPaid = (factoryPaymentsData || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0)
  const totalToPay = Math.max(0, totalAllotmentCost - totalFactoryPaid)

  const activeLots = (lotsData || []).filter((l) => l.status !== 'completed').length
  const overdueLots = (lotsData || []).filter(
    (l) => l.due_date && new Date(l.due_date) < new Date() && l.status !== 'completed'
  ).length

  const todayDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Executive Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xs uppercase tracking-wider font-mono font-bold text-slate-400">
              Factory Operations
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-3xs uppercase tracking-wider font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Live Production Floor
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            {business.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Owner: {business.owner_name || 'Production Admin'} &bull; System Date: {todayDateFormatted}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/lots/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-2xs transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create New Lot</span>
          </Link>
          <Link
            href="/workers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Attendance & Floor</span>
          </Link>
        </div>
      </div>

      {/* Unified Executive Metric Ribbon */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* Total Receivable */}
          <Link href="/veparis" className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors block group">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                Receivables (Vepari)
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                {formatCurrency(totalReceivable)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              From {(veparisData || []).length} registered traders
            </p>
          </Link>

          {/* Total Payable to Factories */}
          <Link href="/factories" className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors block group">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                Partner Payables
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono tabular-nums tracking-tight">
                {formatCurrency(totalToPay)}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              External embroidery units balance
            </p>
          </Link>

          {/* Active Production Lots */}
          <Link href="/lots" className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors block group">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                Running Lots
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                {activeLots}
              </span>
              <span className="text-xs text-slate-400 font-mono">Active</span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              Current floor & partner assignments
            </p>
          </Link>

          {/* Overdue Lots */}
          <Link href="/reminders" className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors block group">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                Delivery Alerts
              </span>
              <AlertCircle className={`w-3.5 h-3.5 ${overdueLots > 0 ? 'text-rose-500' : 'text-slate-300'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight ${
                overdueLots > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {overdueLots}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {overdueLots > 0 ? 'Overdue' : 'On Track'}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              {overdueLots > 0 ? 'Immediate follow-up needed' : 'All delivery commitments on schedule'}
            </p>
          </Link>
        </div>
      </div>

      {/* Primary Workflow Command Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500">
            Operational Workflows
          </h2>
          <span className="text-3xs font-mono text-slate-400">Standard Manufacturing Modules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <WorkflowCard
            href="/lots/new"
            title="Create New Lot"
            desc="Record client lot with parts, stitch work & multi-head rates"
            icon={PackagePlus}
            badge="New"
          />
          <WorkflowCard
            href="/lots"
            title="Production Floor"
            desc="Track in-house shifts, outside factory challans & status"
            icon={Factory}
          />
          <WorkflowCard
            href="/workers"
            title="Workers & Attendance"
            desc="Daily 1.0 / 1.5 / 2.0 shifts, monthly salary divisor & upaad"
            icon={UserCheck}
            badge="Hajiri"
          />
          <WorkflowCard
            href="/veparis"
            title="Trader Accounts"
            desc="Vepari ledgers, outstanding balances & payment vouchers"
            icon={Users}
          />
        </div>
      </div>

      {/* Production Balance Status Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Khatodara Production Ledger Summary</h3>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Live net receivable surplus stands at <span className="font-mono font-bold text-white">{formatCurrency(Math.max(0, totalReceivable - totalToPay))}</span> across current external contracts and trade accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/reports"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            Audit Statements
          </Link>
          <Link
            href="/business-linking"
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
          >
            Network Linking
          </Link>
        </div>
      </div>
    </div>
  )
}

function WorkflowCard({
  href,
  title,
  desc,
  icon: Icon,
  badge,
}: {
  href: string
  title: string
  desc: string
  icon: any
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <Icon className="w-4 h-4" />
          </div>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {badge}
            </span>
          )}
        </div>
        <p className="font-bold text-xs text-slate-900 group-hover:text-slate-700 transition-colors">
          {title}
        </p>
        <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
          {desc}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-3xs font-mono text-slate-400 group-hover:text-slate-900 transition-colors">
        <span>Launch module</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}
