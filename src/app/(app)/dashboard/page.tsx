import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

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

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{business.owner_name ? `, ${business.owner_name}` : ''}!
        </h1>
        <p className="text-gray-500 mt-1">{business.name}</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          href="/veparis"
          title="Total to Receive"
          value={formatCurrency(totalReceivable)}
          subtitle="From veparis & traders"
          color="indigo"
        />
        <StatCard
          href="/factories"
          title="Total to Pay"
          value={formatCurrency(totalToPay)}
          subtitle="To partner factories"
          color="orange"
        />
        <StatCard
          href="/lots"
          title="Lots in Production"
          value={activeLots.toString()}
          subtitle="Active running lots"
          color="blue"
        />
        <StatCard
          href="/lots"
          title="Overdue Lots"
          value={overdueLots.toString()}
          subtitle="Past promised delivery date"
          color={overdueLots > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Quick Action Shortcuts */}
      <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          href="/lots/new"
          label="Add New Lot"
          icon="📦"
          desc="Record a lot with garments, work types & rates"
        />
        <QuickAction
          href="/veparis"
          label="Manage Veparis"
          icon="👤"
          desc="View trader balances, ledgers & receive payment"
        />
        <QuickAction
          href="/factories"
          label="Factories & Allotment"
          icon="🏭"
          desc="Assign pieces to factories and track progress"
        />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  href,
}: {
  title: string
  value: string
  subtitle: string
  color: string
  href?: string
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700 font-bold',
    green: 'bg-green-50 text-green-700',
  }

  const cardContent = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        {href && <span className="text-xs text-indigo-500 font-medium">View &rarr;</span>}
      </div>
      <p className={`text-2xl font-bold mt-2 ${colors[color] ?? ''} inline-block px-2.5 py-0.5 rounded-md`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{cardContent}</Link>
  }

  return cardContent
}

function QuickAction({
  href,
  label,
  icon,
  desc,
}: {
  href: string
  label: string
  icon: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-xs transition-all group"
    >
      <span className="text-3xl p-2 bg-gray-50 rounded-lg group-hover:scale-105 transition-transform">
        {icon}
      </span>
      <div>
        <p className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </Link>
  )
}
