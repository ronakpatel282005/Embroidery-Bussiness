'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  PackagePlus,
  UserCheck,
  Receipt,
  Clock,
  Sparkles,
  Command,
} from 'lucide-react'
import CommandPalette from '@/components/layout/CommandPalette'

export default function TopHeader() {
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [timeStr, setTimeStr] = useState('')

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
      <header className="h-13 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs backdrop-blur-xs">
        {/* Left: Quick Search Button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100/70 hover:border-slate-300 transition-all text-xs font-medium"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Search lots, clients, factories...</span>
            <span className="sm:hidden">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Operational Telemetry & Quick Action */}
        <div className="flex items-center gap-3">
          {/* Shift Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-2xs font-mono font-medium text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Shift Active</span>
            <span className="text-slate-300">•</span>
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-700 font-semibold">{timeStr || '10:00 AM'}</span>
          </div>

          {/* Direct Action Dropdown / Button */}
          <Link
            href="/lots/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Inward Lot</span>
            <span className="sm:hidden">Lot</span>
          </Link>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </>
  )
}
