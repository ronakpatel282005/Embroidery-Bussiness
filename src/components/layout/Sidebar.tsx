'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Package,
  Factory,
  UserCheck,
  ShoppingBag,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Link2,
  Sparkles,
} from 'lucide-react'

const navGroups = [
  {
    heading: 'Core Operations',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/lots', label: 'Lots Directory', icon: Package },
      { href: '/factories', label: 'Factories & Floor', icon: Factory },
      { href: '/workers', label: 'Workers & Payroll', icon: UserCheck },
    ],
  },
  {
    heading: 'Finance & Supply',
    items: [
      { href: '/veparis', label: 'Veparis (Traders)', icon: Users },
      { href: '/material-shops', label: 'Material & Spares', icon: ShoppingBag },
      { href: '/reports', label: 'Reports & Hisaab', icon: BarChart3 },
    ],
  },
  {
    heading: 'Connectivity',
    items: [
      { href: '/business-linking', label: 'Business Linking', icon: Link2 },
      { href: '/reminders', label: 'Active Reminders', icon: Bell },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 select-none">
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {/* Custom Embroidery Machine / Needle Icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M8 9.5l8 5M8 14.5l8-5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-xs tracking-tight leading-tight truncate">
              Khatodara Flow
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-3xs font-mono font-medium text-slate-400 uppercase tracking-wider">
                Production Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.heading} className="space-y-1">
            <p className="px-2.5 text-3xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-slate-800 text-white font-semibold shadow-2xs border border-slate-700/80'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer & Sign out */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-1.5 w-full rounded-md text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 border border-transparent transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
