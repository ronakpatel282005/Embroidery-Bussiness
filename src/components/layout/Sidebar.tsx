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
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { t, language } = useLanguage()

  const handleSignOut = async () => {
    // Clear demo cookie if present
    document.cookie = 'demo_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navGroups = [
    {
      heading: language === 'gu' ? 'મુખ્ય કામગીરી' : language === 'hi' ? 'मुख्य कार्य' : 'Core Operations',
      items: [
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { href: '/lots', label: t('lots'), icon: Package },
        { href: '/factories', label: t('factories'), icon: Factory },
        { href: '/workers', label: t('workers'), icon: UserCheck },
      ],
    },
    {
      heading: language === 'gu' ? 'નાણાં અને સ્ટોક' : language === 'hi' ? 'वित्त एवं स्टॉक' : 'Finance & Supply',
      items: [
        { href: '/veparis', label: t('veparis'), icon: Users },
        { href: '/material-shops', label: t('materials'), icon: ShoppingBag },
        { href: '/reports', label: t('reports'), icon: BarChart3 },
      ],
    },
    {
      heading: language === 'gu' ? 'કનેક્ટિવિટી' : language === 'hi' ? 'कनेक्टिविटी' : 'Connectivity',
      items: [
        { href: '/business-linking', label: t('linking'), icon: Link2 },
        { href: '/reminders', label: t('reminders'), icon: Bell },
        { href: '/settings', label: t('settings'), icon: Settings },
      ],
    },
  ]

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
            <p className="px-3 py-1 text-3xs font-bold uppercase tracking-wider font-mono text-slate-400">
              {group.heading}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                    isActive
                      ? 'bg-slate-800 text-white font-semibold border-l-2 border-emerald-400 rounded-l-none'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* System Footer & Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'gu' ? 'લોગ આઉટ (Sign Out)' : language === 'hi' ? 'लॉग आउट' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
  )
}
