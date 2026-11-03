import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'
import DemoBanner from '@/components/layout/DemoBanner'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Embroidery Business Platform — Khatodara Flow',
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isDemo = cookieStore.get('demo_mode')?.value === 'true'

  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unconfigured or offline
  }

  if (!user && !isDemo) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50/60 font-sans antialiased text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        {isDemo && <DemoBanner />}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
