'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  PackagePlus,
  Clock,
  Command,
  Languages,
} from 'lucide-react'
import CommandPalette from '@/components/layout/CommandPalette'
import { useLanguage, Language } from '@/context/LanguageContext'

export default function TopHeader() {
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [timeStr, setTimeStr] = useState('')
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <header className="h-13 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs backdrop-blur-xs">
        {/* Left: Quick Search Button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100/70 hover:border-slate-300 transition-all text-xs font-medium"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">{t('searchPlaceholder')}</span>
            <span className="sm:hidden">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Language Switcher, Shift Telemetry & Quick Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher Segmented Control */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 text-2xs font-semibold rounded transition-all ${
                language === 'en'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('gu')}
              className={`px-2 py-1 text-2xs font-bold rounded transition-all ${
                language === 'gu'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ગુજરાતી (Gujarati)"
            >
              ગુજ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-2 py-1 text-2xs font-bold rounded transition-all ${
                language === 'hi'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="हिंदी (Hindi)"
            >
              हिं
            </button>
          </div>

          {/* Shift Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-2xs font-mono font-medium text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('shiftActive')}</span>
            <span className="text-slate-300">•</span>
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-700 font-semibold">{timeStr || '10:00 AM'}</span>
          </div>

          {/* Direct Action Button */}
          <Link
            href="/lots/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5 text-slate-300" />
            <span>{t('inwardLot')}</span>
          </Link>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </>
  )
}
