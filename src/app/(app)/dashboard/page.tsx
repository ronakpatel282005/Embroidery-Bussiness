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
    { data: recentPaymentsData },
  ] = await Promise.all([
    supabase.from('veparis').select('id, name, opening_balance').eq('business_id', business.id),
    supabase
      .from('lots')
      .select('id, lot_number, total_amount, total_pieces, due_date, status, date, created_at, veparis(name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase.from('vepari_payments').select('amount').eq('business_id', business.id),
    supabase.from('lot_allotments').select('total_amount, factories(is_own)').eq('business_id', business.id),
    supabase.from('factory_payments').select('amount').eq('business_id', business.id),
    supabase
      .from('vepari_payments')
      .select('id, amount, payment_date, payment_mode, veparis(name)')
      .eq('business_id', business.id)
      .order('payment_date', { ascending: false })
      .limit(5),
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

  // Production Stage Pipeline Counts
  const allLots = lotsData || []
  const receivedLots = allLots.filter((l) => l.status === 'received')
  const inProgressLots = allLots.filter((l) => l.status === 'in_progress')
  const completedLots = allLots.filter((l) => l.status === 'completed')

  const totalPiecesInProcess = inProgressLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)
  const totalPiecesReceived = receivedLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)
  const totalPiecesCompleted = completedLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)

  const activeLots = inProgressLots.length + receivedLots.length
  const overdueLots = allLots.filter(
    (l) => l.due_date && new Date(l.due_date) < new Date() && l.status !== 'completed'
  ).length

  const recentLots = allLots.slice(0, 5)
  const recentPayments = recentPaymentsData || []

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
            <PackagePlus className="w-3.5 h-3.5 text-slate-300" />
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
              {totalPiecesInProcess.toLocaleString('en-IN')} pieces running
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

      {/* Production Pipeline Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Production Stage Telemetry
            </h2>
            <p className="text-2xs text-slate-500 mt-0.5">Live distribution of work across manufacturing milestones</p>
          </div>
          <Link href="/lots" className="text-2xs font-mono font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
            <span>View all lots</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Stage 1 */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-mono uppercase font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                01. Inward Intake
              </span>
              <span className="text-2xs font-mono font-bold text-slate-700">{receivedLots.length} lots</span>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight mt-2">
              {totalPiecesReceived.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">pcs</span>
            </p>
            <p className="text-3xs text-slate-500 mt-1">Awaiting machine floor allotment</p>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-mono uppercase font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                02. On Machines (Running)
              </span>
              <span className="text-2xs font-mono font-bold text-slate-700">{inProgressLots.length} lots</span>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight mt-2">
              {totalPiecesInProcess.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">pcs</span>
            </p>
            <p className="text-3xs text-slate-500 mt-1">Active stitching in-house & partners</p>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-mono uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                03. Finished & Billed
              </span>
              <span className="text-2xs font-mono font-bold text-slate-700">{completedLots.length} lots</span>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900 tracking-tight mt-2">
              {totalPiecesCompleted.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">pcs</span>
            </p>
            <p className="text-3xs text-slate-500 mt-1">Ready or delivered to trader</p>
          </div>
        </div>
      </div>

      {/* Real-Time Operational Stream Split (Recent Lots + Recent Collections) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inward Lots */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2">
              <PackagePlus className="w-3.5 h-3.5 text-slate-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recent Inward Lots
              </h2>
            </div>
            <Link href="/lots" className="text-2xs font-mono font-semibold text-slate-600 hover:text-slate-900">
              View All →
            </Link>
          </div>

          {recentLots.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono">
              No lots recorded yet. Click &quot;Create New Lot&quot; above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLots.map((lot: any) => (
                <Link
                  key={lot.id}
                  href={`/lots/${lot.id}`}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors block group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-slate-700">
                        {lot.lot_number}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-3xs font-mono font-semibold ${
                          lot.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : lot.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {lot.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-0.5 truncate">
                      {lot.veparis?.name || 'Unknown Trader'} &bull; {lot.total_pieces?.toLocaleString('en-IN')} pcs
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-xs text-slate-900">
                      {formatCurrency(lot.total_amount)}
                    </p>
                    <p className="text-3xs font-mono text-slate-400 mt-0.5">
                      {lot.date}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Financial Collections */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recent Collections Realized
              </h2>
            </div>
            <Link href="/veparis" className="text-2xs font-mono font-semibold text-slate-600 hover:text-slate-900">
              Trader Ledgers →
            </Link>
          </div>

          {recentPayments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono">
              No payments logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {p.veparis?.name || 'Direct Receipt'}
                    </p>
                    <p className="text-3xs font-mono text-slate-400 mt-0.5">
                      Mode: {p.payment_mode || 'Cash'} &bull; {p.payment_date}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-xs text-emerald-700">
                      +{formatCurrency(p.amount)}
                    </p>
                    <span className="text-3xs font-mono text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                      Cleared
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
