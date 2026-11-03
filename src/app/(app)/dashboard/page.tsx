import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import {
  PackagePlus,
  Users,
  Factory,
  UserCheck,
  Receipt,
  ArrowUpRight,
  ArrowRight,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import {
  DEMO_BUSINESS,
  DEMO_VEPARIS,
  DEMO_FACTORIES,
  DEMO_LOTS,
  getDemoDashboardMetrics,
} from '@/lib/demoData'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const isDemo = cookieStore.get('demo_mode')?.value === 'true'

  let user = null
  let business = null
  let veparisData: any[] = []
  let lotsData: any[] = []
  let paymentsData: any[] = []
  let allotmentsData: any[] = []
  let factoryPaymentsData: any[] = []
  let recentPaymentsData: any[] = []

  if (!isDemo) {
    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()
      user = userData?.user || null

      if (user) {
        const { data: bizData } = await supabase
          .from('businesses')
          .select('*')
          .eq('user_id', user.id)
          .single()
        business = bizData
      }
    } catch {
      // Offline or unconfigured
    }
  }

  // If not signed in and not demo, redirect to login
  if (!user && !isDemo) {
    redirect('/auth/login')
  }

  let totalReceivable = 0
  let totalToPay = 0
  let activeLots = 0
  let overdueLotsCount = 0
  let overdueAmount = 0
  let overdueLotsList: any[] = []
  let receivedLots: any[] = []
  let inProgressLots: any[] = []
  let completedLots: any[] = []
  let totalPiecesInProcess = 0
  let totalPiecesReceived = 0
  let totalPiecesCompleted = 0
  let recentLots: any[] = []
  let recentPayments: any[] = []

  if (isDemo || !business) {
    // Populate with realistic Surat Embroidery Demo Business
    business = DEMO_BUSINESS
    const metrics = getDemoDashboardMetrics()
    totalReceivable = metrics.totalReceivable
    totalToPay = metrics.totalPayable
    activeLots = DEMO_LOTS.filter((l) => l.status === 'in_progress' || l.status === 'received').length
    overdueLotsCount = metrics.overdueLotsCount
    overdueAmount = metrics.overdueAmount
    overdueLotsList = metrics.overdueLots
    receivedLots = DEMO_LOTS.filter((l) => l.status === 'received')
    inProgressLots = DEMO_LOTS.filter((l) => l.status === 'in_progress')
    completedLots = DEMO_LOTS.filter((l) => l.status === 'completed')

    totalPiecesInProcess = inProgressLots.reduce((s, l) => s + l.total_pieces, 0)
    totalPiecesReceived = receivedLots.reduce((s, l) => s + l.total_pieces, 0)
    totalPiecesCompleted = completedLots.reduce((s, l) => s + l.total_pieces, 0)

    recentLots = DEMO_LOTS.slice(0, 6)
    recentPayments = [
      { id: 'dp-1', veparis: { name: 'Navkar Fashions (નવકાર ફેશન)' }, amount: 45000, payment_mode: 'RTGS / Bank', payment_date: '2026-11-02' },
      { id: 'dp-2', veparis: { name: 'Jay Ambe Fabrics' }, amount: 35000, payment_mode: 'Cheque Cleared', payment_date: '2026-11-01' },
      { id: 'dp-3', veparis: { name: 'Shreeram Prints' }, amount: 60000, payment_mode: 'UPI Khata', payment_date: '2026-10-30' },
      { id: 'dp-4', veparis: { name: 'Mahadev Textiles' }, amount: 25000, payment_mode: 'Cash Receipt', payment_date: '2026-10-28' },
    ]
  } else {
    // Live Supabase database
    const supabase = await createClient()
    const [
      vepRes,
      lotRes,
      payRes,
      allotRes,
      facPayRes,
      recPayRes,
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

    veparisData = vepRes.data || []
    lotsData = lotRes.data || []
    paymentsData = payRes.data || []
    allotmentsData = allotRes.data || []
    factoryPaymentsData = facPayRes.data || []
    recentPaymentsData = recPayRes.data || []

    const totalOpening = veparisData.reduce((sum, v) => sum + Number(v.opening_balance || 0), 0)
    const totalLotsAmount = lotsData.reduce((sum, l) => sum + Number(l.total_amount || 0), 0)
    const totalPayments = paymentsData.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    totalReceivable = Math.max(0, totalOpening + totalLotsAmount - totalPayments)

    const totalAllotmentCost = allotmentsData
      .filter((a: any) => !a.factories?.is_own)
      .reduce((sum, a: any) => sum + Number(a.total_amount || 0), 0)
    const totalFactoryPaid = factoryPaymentsData.reduce((sum, p: any) => sum + Number(p.amount || 0), 0)
    totalToPay = Math.max(0, totalAllotmentCost - totalFactoryPaid)

    receivedLots = lotsData.filter((l) => l.status === 'received')
    inProgressLots = lotsData.filter((l) => l.status === 'in_progress')
    completedLots = lotsData.filter((l) => l.status === 'completed')

    totalPiecesInProcess = inProgressLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)
    totalPiecesReceived = receivedLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)
    totalPiecesCompleted = completedLots.reduce((sum, l) => sum + Number(l.total_pieces || 0), 0)

    activeLots = inProgressLots.length + receivedLots.length
    overdueLotsList = lotsData.filter(
      (l) => l.due_date && new Date(l.due_date) < new Date() && l.status !== 'completed'
    )
    overdueLotsCount = overdueLotsList.length
    overdueAmount = overdueLotsList.reduce((s, l) => s + Number(l.total_amount || 0), 0)

    recentLots = lotsData.slice(0, 5)
    recentPayments = recentPaymentsData
  }

  const todayDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
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
            Owner: {business.owner_name || 'Production Admin'} &bull; Date: {todayDateFormatted}
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

      {/* Prominent Overdue Strip Alert */}
      {overdueLotsCount > 0 && (
        <div className="bg-rose-950 border border-rose-800 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-900 border border-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider font-mono text-rose-300">
                  Overdue Lots & Payment Alert
                </span>
                <span className="text-3xs font-mono bg-rose-900 px-1.5 py-0.5 rounded border border-rose-700 text-rose-200 font-bold">
                  {overdueLotsCount} Lots Past Due
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-1">
                <span className="font-mono font-bold text-rose-300">{formatCurrency(overdueAmount)}</span> pending collection across overdue lots. Follow up with traders to release payments.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://wa.me/919825123450?text=${encodeURIComponent(
                `નમસ્તે, રાધે એમ્બ્રોઇડરી તરફથી જાણ: તમારા ${overdueLotsCount} લોટ (બાકી રકમ: ${formatCurrency(overdueAmount)}) તૈયાર છે અને ડિલિવરી તારીખ વીતી ગઈ છે. કૃપા કરીને ચુકવણી અને ઉપાડ બાબતે સંપર્ક કરશો.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-2xs"
            >
              <span>WhatsApp Reminder</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Unified Industrial Metric Ribbon */}
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
              Outstanding from registered traders
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
              <span className="text-xs text-slate-400 font-mono">Lots</span>
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
              <AlertCircle className={`w-3.5 h-3.5 ${overdueLotsCount > 0 ? 'text-rose-500' : 'text-slate-300'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight ${
                overdueLotsCount > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {overdueLotsCount}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {overdueLotsCount > 0 ? 'Overdue' : 'On Track'}
              </span>
            </div>
            <p className="text-3xs font-mono text-slate-500 mt-1">
              {overdueLotsCount > 0 ? 'Immediate follow-up required' : 'All delivery commitments on schedule'}
            </p>
          </Link>
        </div>
      </div>

      {/* Production Pipeline Telemetry */}
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
            <p className="text-3xs text-slate-500 mt-1">Stitches running across multi-head frames</p>
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
            <p className="text-3xs text-slate-500 mt-1">Mended, packed & challan invoiced</p>
          </div>
        </div>
      </div>

      {/* Grid: Active Lots Table & Recent Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Production Lots Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Active Production Lots
              </h2>
            </div>
            <Link href="/lots" className="text-2xs font-mono font-semibold text-slate-600 hover:text-slate-900">
              View All Lots →
            </Link>
          </div>

          {recentLots.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono">
              No lots logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLots.map((lot: any) => (
                <Link
                  key={lot.id}
                  href={`/lots/${lot.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 transition-colors block"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {lot.lot_number}
                      </span>
                      <span
                        className={`text-3xs font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
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
                      {lot.vepari_name || lot.veparis?.name || 'Vepari'} &bull; {lot.total_pieces?.toLocaleString('en-IN')} pcs
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-xs text-slate-900 tabular-nums">
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
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
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
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {p.veparis?.name || 'Direct Receipt'}
                    </p>
                    <p className="text-3xs font-mono text-slate-400 mt-0.5">
                      Mode: {p.payment_mode || 'Bank'} &bull; {p.payment_date}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-xs text-emerald-700 tabular-nums">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-2xs"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <Icon className="w-4 h-4" />
          </div>
          {badge && (
            <span className="text-3xs font-mono uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {badge}
            </span>
          )}
        </div>
        <h3 className="font-bold text-xs text-slate-900 group-hover:text-slate-950 transition-colors">
          {title}
        </h3>
        <p className="text-2xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
          {desc}
        </p>
      </div>

      <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-3xs font-mono font-semibold text-slate-400 group-hover:text-slate-900 transition-colors">
        <span>Launch Module</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}
