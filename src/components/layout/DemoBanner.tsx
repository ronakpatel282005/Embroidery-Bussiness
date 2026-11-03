'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, LogOut, Info } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function DemoBanner() {
  const router = useRouter()
  const { language } = useLanguage()

  const handleExitDemo = () => {
    // Clear demo_mode cookie
    document.cookie = 'demo_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="bg-slate-900 text-slate-200 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-3xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Demo Mode
        </span>
        <span className="font-medium text-slate-300">
          {language === 'gu'
            ? 'રાધે એમ્બ્રોઇડરી (સુરત) — ૧૦ લોટ, ૫ વેપારી, ૪ કારખાના અને કારીગર હિસાબ સાથે લાઇવ ડેમો'
            : language === 'hi'
            ? 'राधे एम्ब्रॉयडरी (सूरत) — १० लॉट, ५ व्यापारी, ४ कारखाने और कारीगर हिसाब के साथ लाइव डेमो'
            : 'Radhe Embroidery (Surat) — Exploring live with 10 lots, 5 traders, 4 factories & payroll'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleExitDemo}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-2xs font-mono font-medium transition-colors"
        >
          <LogOut className="w-3 h-3 text-slate-400" />
          <span>{language === 'gu' ? 'ડેમોમાંથી બહાર નીકળો' : language === 'hi' ? 'डेमो से बाहर निकलें' : 'Exit Demo'}</span>
        </button>
      </div>
    </div>
  )
}
