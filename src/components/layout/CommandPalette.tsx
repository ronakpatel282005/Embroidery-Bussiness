'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  PackagePlus,
  Package,
  Users,
  Factory,
  UserCheck,
  Receipt,
  ShoppingBag,
  BarChart3,
  Link2,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  category: 'Actions' | 'Navigation' | 'Masters'
  href: string
  icon: any
  shortcut?: string
}

const commands: CommandItem[] = [
  // Actions
  { id: 'new-lot', title: 'Create Inward Lot', category: 'Actions', href: '/lots/new', icon: PackagePlus, shortcut: 'N' },
  { id: 'workers-shift', title: 'Record Worker Shift (Hajiri)', category: 'Actions', href: '/workers', icon: UserCheck, shortcut: 'W' },
  { id: 'view-veparis', title: 'Receive Trader Payment', category: 'Actions', href: '/veparis', icon: Receipt, shortcut: 'R' },
  { id: 'business-link', title: 'Link Partner Factory / Client', category: 'Actions', href: '/business-linking', icon: Link2 },

  // Navigation
  { id: 'nav-dashboard', title: 'Executive Overview', category: 'Navigation', href: '/dashboard', icon: BarChart3 },
  { id: 'nav-lots', title: 'Lots Directory & Allotments', category: 'Navigation', href: '/lots', icon: Package },
  { id: 'nav-factories', title: 'Factories & Job Floors', category: 'Navigation', href: '/factories', icon: Factory },
  { id: 'nav-veparis', title: 'Trader (Vepari) Ledgers', category: 'Navigation', href: '/veparis', icon: Users },
  { id: 'nav-workers', title: 'Workers & Floor Payroll', category: 'Navigation', href: '/workers', icon: UserCheck },
  { id: 'nav-materials', title: 'Material & Spare Suppliers', category: 'Navigation', href: '/material-shops', icon: ShoppingBag },
  { id: 'nav-reports', title: 'Audit Reports & Statements', category: 'Navigation', href: '/reports', icon: BarChart3 },
  { id: 'nav-settings', title: 'Workspace Settings & Masters', category: 'Navigation', href: '/settings', icon: Settings },
]

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = useCallback((item: CommandItem) => {
    onClose()
    setQuery('')
    router.push(item.href)
  }, [onClose, router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onClose()
      }
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, handleSelect, isOpen, onClose, selectedIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-100 bg-slate-50/50">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search modules..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            autoFocus
            className="w-full h-12 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-3xs font-mono font-medium text-slate-400 bg-white border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 font-mono">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors text-xs ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-slate-800 text-slate-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <p className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {item.title}
                      </p>
                      <p className={`text-3xs font-mono ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                        {item.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd
                        className={`text-3xs font-mono px-1.5 py-0.5 rounded border ${
                          isSelected
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3 h-3 ${isSelected ? 'text-slate-400' : 'text-slate-300'}`} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-3xs font-mono text-slate-400">
          <span>Navigate with ↑ ↓ • Press Enter to run</span>
          <span>Khatodara Flow CLI</span>
        </div>
      </div>
    </div>
  )
}
