'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/modal'
import FormattedNumberInput from '@/components/ui/formatted-number-input'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Users,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileText,
  Wallet,
  Sun,
  Moon,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Layers,
  Share2,
  Eye,
} from 'lucide-react'

export interface WageRevision {
  effective_from: string // YYYY-MM-DD or YYYY-MM (first month/day this wage applies)
  wage_type: 'monthly' | 'piece_rate' | 'daily'
  wage_rate: number
  notes?: string
}

export interface Worker {
  id: string
  name: string
  phone: string
  role: string
  wage_type: 'monthly' | 'piece_rate' | 'daily'
  wage_rate: number
  wage_history?: WageRevision[] // Historical wage revisions for audit-proof past payroll
  shift: 'Day' | 'Night' | 'General'
  assigned_machine?: string
  status: 'active' | 'on_leave' | 'left' | 'inactive'
  joined_date: string // YYYY-MM-DD
  left_date?: string // YYYY-MM-DD when worker left or resigned
  settlement_notes?: string
}

// Audit-proof wage resolver: returns the exact wage applicable for a specific month or date
export function getWorkerWageForMonth(
  worker: Worker,
  targetMonthOrDate: string
): { wage_rate: number; wage_type: Worker['wage_type'] } {
  if (!worker.wage_history || worker.wage_history.length === 0) {
    return { wage_rate: worker.wage_rate, wage_type: worker.wage_type }
  }

  // targetMonthOrDate can be 'YYYY-MM' or 'YYYY-MM-DD'
  const compareKey = targetMonthOrDate.length === 7 ? `${targetMonthOrDate}-28` : targetMonthOrDate
  const sorted = [...worker.wage_history].sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  const match = sorted.find((r) => r.effective_from <= compareKey)

  if (match) {
    return { wage_rate: match.wage_rate, wage_type: match.wage_type }
  }

  // If queried before the first recorded revision, return the earliest revision
  return { wage_rate: sorted[sorted.length - 1].wage_rate, wage_type: sorted[sorted.length - 1].wage_type }
}

export interface WorkerAttendanceRecord {
  id: string
  worker_id: string
  date: string // YYYY-MM-DD
  status: 'present' | 'half_day' | 'absent' | 'holiday'
  shift_units?: number // 1.0 = Single machine, 1.5 = 1.5 machine, 2.0 = Double machine (2 Present), 0.5 = Half day, 0 = Absent
  second_machine?: string // Optional: name of 2nd machine operated
  overtime_hours: number
  notes?: string
}

export interface WorkerSalaryPayment {
  id: string
  worker_id: string
  worker_name: string
  month: string // YYYY-MM
  amount: number
  payment_date: string
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'
  payment_type: 'Salary' | 'Advance' | 'Bonus' | 'Overtime'
  notes?: string
}

export interface WorkerShiftLog {
  id: string
  worker_id: string
  worker_name: string
  lot_number: string
  garment_part: string
  pieces_completed: number
  piece_rate: number
  total_earned: number
  shift_date: string
  shift_type: 'Day' | 'Night'
}

const DEFAULT_ROLES = [
  'Machine Operator',
  'Embroidery Master',
  'Thread Cutter (Dora Cutting)',
  'Checker / Packing',
  'Sequins & Cording Operator',
  'Punching / CAD Designer',
  'Helper / Floor Boy',
  'Maintenance Mechanic',
]

const DEFAULT_WORKERS: Worker[] = [
  {
    id: 'w-1',
    name: 'Ramesh Kumar (Operator)',
    phone: '9876543210',
    role: 'Machine Operator',
    wage_type: 'monthly',
    wage_rate: 22000,
    shift: 'Day',
    assigned_machine: 'Machine #1 (Multi-Head)',
    status: 'active',
    joined_date: '2025-01-15',
  },
  {
    id: 'w-2',
    name: 'Suresh Bhai (Master)',
    phone: '9825123456',
    role: 'Embroidery Master',
    wage_type: 'monthly',
    wage_rate: 32000,
    shift: 'General',
    assigned_machine: 'Main Floor & Wilcom Hall',
    status: 'active',
    joined_date: '2024-06-01',
  },
  {
    id: 'w-3',
    name: 'Mukesh Yadav',
    phone: '9898712345',
    role: 'Thread Cutter (Dora Cutting)',
    wage_type: 'piece_rate',
    wage_rate: 4,
    shift: 'Day',
    assigned_machine: 'Finishing Table #1',
    status: 'active',
    joined_date: '2025-08-10',
  },
  {
    id: 'w-4',
    name: 'Dinesh Prajapati',
    phone: '9712345678',
    role: 'Machine Operator',
    wage_type: 'monthly',
    wage_rate: 22000,
    shift: 'Night',
    assigned_machine: 'Machine #1 (Multi-Head)',
    status: 'active',
    joined_date: '2025-10-01',
  },
  {
    id: 'w-5',
    name: 'Bablu Sahni',
    phone: '9879012345',
    role: 'Sequins & Cording Operator',
    wage_type: 'daily',
    wage_rate: 800,
    shift: 'Day',
    assigned_machine: 'Machine #2 (Multi-Head)',
    status: 'active',
    joined_date: '2026-02-01',
  },
]

export default function WorkersPage() {
  const supabase = createClient()

  const [businessName, setBusinessName] = useState<string>('Embroidery Factory Floor')
  const [businessPhone, setBusinessPhone] = useState<string>('')
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<WorkerAttendanceRecord[]>([])
  const [salaryPayments, setSalaryPayments] = useState<WorkerSalaryPayment[]>([])
  const [logs, setLogs] = useState<WorkerShiftLog[]>([])
  const [rolesList, setRolesList] = useState<string[]>(DEFAULT_ROLES)
  const [loading, setLoading] = useState(true)

  // Navigation & Primary Tabs
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary' | 'roster' | 'logs'>('attendance')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState<'all' | 'Day' | 'Night' | 'General'>('all')
  const [stationFilter, setStationFilter] = useState('all')

  // Attendance Date
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])

  // Salary Month (YYYY-MM)
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7))

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [payingWorker, setPayingWorker] = useState<Worker | null>(null)
  const [loggingWorker, setLoggingWorker] = useState<Worker | null>(null)
  const [quickUpaadWorker, setQuickUpaadWorker] = useState<Worker | null>(null)
  const [hisaabSlipWorker, setHisaabSlipWorker] = useState<Worker | null>(null)
  const [selectedProfileWorker, setSelectedProfileWorker] = useState<Worker | null>(null)
  const [isManageRolesOpen, setIsManageRolesOpen] = useState(false)
  const [newRoleInput, setNewRoleInput] = useState('')
  const [editingRoleOrig, setEditingRoleOrig] = useState<string | null>(null)
  const [editingRoleValue, setEditingRoleValue] = useState('')

  // Form states for Worker Add/Edit
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('Machine Operator')
  const [customRole, setCustomRole] = useState('')
  const [isCustomRole, setIsCustomRole] = useState(false)
  const [wageType, setWageType] = useState<Worker['wage_type']>('monthly')
  const [wageRate, setWageRate] = useState<number | string>(20000)
  const [shift, setShift] = useState<Worker['shift']>('Day')
  const [machine, setMachine] = useState('')
  const [joinedDate, setJoinedDate] = useState(new Date().toISOString().split('T')[0])
  const [workerStatus, setWorkerStatus] = useState<Worker['status']>('active')
  const [leftDate, setLeftDate] = useState('')
  const [wageEffectiveMonth, setWageEffectiveMonth] = useState(new Date().toISOString().slice(0, 7))
  const [wageRevisionNotes, setWageRevisionNotes] = useState('')
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'active' | 'left' | 'all'>('active')

  // Form states for Pay Salary Modal
  const [payAmount, setPayAmount] = useState<number | string>('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payType, setPayType] = useState<WorkerSalaryPayment['payment_type']>('Salary')
  const [payMode, setPayMode] = useState<WorkerSalaryPayment['payment_mode']>('Cash')
  const [payNotes, setPayNotes] = useState('')

  // Form states for Quick Upaad (Advance / Kharcha)
  const [upaadAmount, setUpaadAmount] = useState<number | string>(1000)
  const [upaadMode, setUpaadMode] = useState<WorkerSalaryPayment['payment_mode']>('Cash')
  const [upaadDate, setUpaadDate] = useState(new Date().toISOString().split('T')[0])
  const [upaadNotes, setUpaadNotes] = useState('')

  // Form states for Shift Log
  const [logLot, setLogLot] = useState('')
  const [logPart, setLogPart] = useState('Front')
  const [logPieces, setLogPieces] = useState<number | string>(100)
  const [logRate, setLogRate] = useState<number | string>(5)
  const [logShift, setLogShift] = useState<'Day' | 'Night'>('Day')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])

  // Load all data with localStorage persistence and Supabase business header
  const loadAllData = useCallback(async () => {
    setLoading(true)

    try {
      // 1. Fetch current business name
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: business } = await supabase
          .from('businesses')
          .select('name, phone')
          .eq('user_id', user.id)
          .single()
        if (business?.name) {
          setBusinessName(business.name)
          setBusinessPhone(business.phone || '')
        }
      }

      // 2. Workers
      const savedWorkers = localStorage.getItem('embroidery_workers')
      if (savedWorkers) {
        const parsed: Worker[] = JSON.parse(savedWorkers)
        // Ensure every worker has shift and joined_date
        const normalized = parsed.map((w) => ({
          ...w,
          shift: w.shift || 'Day',
          joined_date: w.joined_date || '2025-01-01',
        }))
        setWorkers(normalized)
      } else {
        setWorkers(DEFAULT_WORKERS)
        localStorage.setItem('embroidery_workers', JSON.stringify(DEFAULT_WORKERS))
      }

      // 3. Attendance
      const savedAtt = localStorage.getItem('embroidery_worker_attendance')
      if (savedAtt) {
        setAttendanceRecords(JSON.parse(savedAtt))
      }

      // 4. Salary Payments
      const savedSal = localStorage.getItem('embroidery_worker_salary_payments')
      if (savedSal) {
        setSalaryPayments(JSON.parse(savedSal))
      }

      // 5. Shift Logs
      const savedLogs = localStorage.getItem('embroidery_worker_logs')
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs))
      }

      // 6. Custom Roles
      const savedRoles = localStorage.getItem('embroidery_custom_roles')
      if (savedRoles) {
        setRolesList(JSON.parse(savedRoles))
      }
    } catch {
      setWorkers(DEFAULT_WORKERS)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const saveWorkers = (data: Worker[]) => {
    setWorkers(data)
    localStorage.setItem('embroidery_workers', JSON.stringify(data))
  }

  const saveAttendance = (data: WorkerAttendanceRecord[]) => {
    setAttendanceRecords(data)
    localStorage.setItem('embroidery_worker_attendance', JSON.stringify(data))
  }

  const saveSalaryPayments = (data: WorkerSalaryPayment[]) => {
    setSalaryPayments(data)
    localStorage.setItem('embroidery_worker_salary_payments', JSON.stringify(data))
  }

  const saveShiftLogs = (data: WorkerShiftLog[]) => {
    setLogs(data)
    localStorage.setItem('embroidery_worker_logs', JSON.stringify(data))
  }

  const saveRoles = (data: string[]) => {
    setRolesList(data)
    localStorage.setItem('embroidery_custom_roles', JSON.stringify(data))
  }

  // --- JOINING & LEAVING DATE ELIGIBILITY ENGINE ---
  // A worker only appears on floor attendance on/after joining date and before/on leaving date!
  const isWorkerEligibleForDate = useCallback((w: Worker, dateStr: string) => {
    if (w.joined_date && w.joined_date > dateStr) return false
    if (w.left_date && w.left_date < dateStr) return false
    if (w.status === 'left' || w.status === 'inactive') {
      if (w.left_date) return dateStr <= w.left_date
      return false
    }
    return true
  }, [])

  // Eligible active workers for the selected floor attendance date
  const eligibleWorkersToday = useMemo(() => {
    return workers.filter((w) => isWorkerEligibleForDate(w, attendanceDate))
  }, [workers, attendanceDate, isWorkerEligibleForDate])

  // Helper for effective shift units (1.0 = single, 1.5 = 1.5 machine, 2.0 = double, 0.5 = half day, 0 = absent)
  const getEffectiveShiftUnits = (r?: WorkerAttendanceRecord): number => {
    if (!r) return 0
    if (typeof r.shift_units === 'number') return r.shift_units
    if (r.status === 'present') return 1.0
    if (r.status === 'half_day') return 0.5
    return 0
  }

  // Get attendance record for specific worker on given date
  const getAttendanceForWorker = (workerId: string, date: string) => {
    return attendanceRecords.find((r) => r.worker_id === workerId && r.date === date)
  }

  // Set single worker attendance with shift units (e.g. 1.0, 1.5, 2.0, 0.5, 0)
  const handleSetAttendance = (
    workerId: string,
    status: WorkerAttendanceRecord['status'],
    shiftUnits: number = 1.0,
    otHours: number = 0,
    secondMachine?: string
  ) => {
    const existingIndex = attendanceRecords.findIndex(
      (r) => r.worker_id === workerId && r.date === attendanceDate
    )

    let updated = [...attendanceRecords]
    if (existingIndex >= 0) {
      updated[existingIndex] = {
        ...updated[existingIndex],
        status,
        shift_units: shiftUnits,
        second_machine: secondMachine !== undefined ? secondMachine : updated[existingIndex].second_machine,
        overtime_hours: otHours,
      }
    } else {
      updated.push({
        id: 'att-' + Date.now() + '-' + workerId,
        worker_id: workerId,
        date: attendanceDate,
        status,
        shift_units: shiftUnits,
        second_machine: secondMachine,
        overtime_hours: otHours,
      })
    }

    saveAttendance(updated)
  }

  // Quick Overtime hours change
  const handleUpdateOvertime = (workerId: string, otHours: number) => {
    const existingIndex = attendanceRecords.findIndex(
      (r) => r.worker_id === workerId && r.date === attendanceDate
    )

    let updated = [...attendanceRecords]
    if (existingIndex >= 0) {
      updated[existingIndex] = {
        ...updated[existingIndex],
        overtime_hours: Math.max(0, otHours),
      }
    } else {
      updated.push({
        id: 'att-' + Date.now() + '-' + workerId,
        worker_id: workerId,
        date: attendanceDate,
        status: 'present',
        shift_units: 1.0,
        overtime_hours: Math.max(0, otHours),
      })
    }

    saveAttendance(updated)
  }

  // Mark all eligible workers present (1.0 single machine shift by default)
  const handleMarkAllPresent = (targetShift?: 'Day' | 'Night') => {
    const targets = eligibleWorkersToday.filter((w) => (targetShift ? w.shift === targetShift : true))

    let updated = [...attendanceRecords]
    targets.forEach((w) => {
      const idx = updated.findIndex((r) => r.worker_id === w.id && r.date === attendanceDate)
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], status: 'present', shift_units: 1.0 }
      } else {
        updated.push({
          id: 'att-' + Date.now() + '-' + w.id,
          worker_id: w.id,
          date: attendanceDate,
          status: 'present',
          shift_units: 1.0,
          overtime_hours: 0,
        })
      }
    })

    saveAttendance(updated)
  }

  // --- WORKER ROLES MANAGEMENT ---
  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newRoleInput.trim()
    if (!trimmed || rolesList.includes(trimmed)) return
    const updated = [...rolesList, trimmed]
    saveRoles(updated)
    setNewRoleInput('')
  }

  const handleRenameRole = (oldRole: string, newRole: string) => {
    const trimmed = newRole.trim()
    if (!trimmed || trimmed === oldRole) {
      setEditingRoleOrig(null)
      return
    }
    const updatedRoles = rolesList.map((r) => (r === oldRole ? trimmed : r))
    saveRoles(updatedRoles)

    const updatedWorkers = workers.map((w) => (w.role === oldRole ? { ...w, role: trimmed } : w))
    saveWorkers(updatedWorkers)

    setEditingRoleOrig(null)
  }

  const handleDeleteRole = (rToDelete: string) => {
    if (rolesList.length <= 1) return
    const updated = rolesList.filter((r) => r !== rToDelete)
    saveRoles(updated)
    if (editingRoleOrig === rToDelete) {
      setEditingRoleOrig(null)
    }
  }

  // --- WORKER ADD / EDIT ---
  const handleOpenAdd = () => {
    setName('')
    setPhone('')
    setRole(rolesList[0] || 'Machine Operator')
    setCustomRole('')
    setIsCustomRole(false)
    setWageType('monthly')
    setWageRate(22000)
    setShift('Day')
    setMachine('Machine #1 (Multi-Head)')
    setJoinedDate(new Date().toISOString().split('T')[0])
    setLeftDate('')
    setWorkerStatus('active')
    setWageEffectiveMonth(salaryMonth)
    setWageRevisionNotes('')
    setIsAddOpen(true)
  }

  const handleOpenEdit = (w: Worker) => {
    setEditingWorker(w)
    setName(w.name)
    setPhone(w.phone)
    if (rolesList.includes(w.role)) {
      setRole(w.role)
      setIsCustomRole(false)
      setCustomRole('')
    } else {
      setIsCustomRole(true)
      setCustomRole(w.role)
    }
    setWageType(w.wage_type)
    setWageRate(w.wage_rate)
    setShift(w.shift || 'Day')
    setMachine(w.assigned_machine || '')
    setJoinedDate(w.joined_date || '2025-01-01')
    setLeftDate(w.left_date || '')
    setWorkerStatus(w.status)
    setWageEffectiveMonth(salaryMonth)
    setWageRevisionNotes('')
  }

  const handleSaveWorker = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const finalRole = isCustomRole ? customRole.trim() || 'Worker' : role

    if (isCustomRole && customRole.trim() && !rolesList.includes(customRole.trim())) {
      saveRoles([...rolesList, customRole.trim()])
    }

    const newRate = Number(wageRate) || 0

    if (editingWorker) {
      // Historical Wage Revision Tracking:
      // Preserves previous months' calculations when a worker's wage is increased!
      let history = editingWorker.wage_history ? [...editingWorker.wage_history] : []
      const wageChanged = editingWorker.wage_rate !== newRate || editingWorker.wage_type !== wageType

      if (wageChanged) {
        // If no baseline revision exists, store the initial joining wage
        if (history.length === 0) {
          history.push({
            effective_from: editingWorker.joined_date || '2025-01-01',
            wage_type: editingWorker.wage_type,
            wage_rate: editingWorker.wage_rate,
            notes: 'Initial joining wage',
          })
        }

        const effKey = wageEffectiveMonth ? `${wageEffectiveMonth}-01` : `${salaryMonth}-01`
        const existingIdx = history.findIndex((h) => h.effective_from === effKey)
        if (existingIdx >= 0) {
          history[existingIdx] = {
            effective_from: effKey,
            wage_type: wageType,
            wage_rate: newRate,
            notes: wageRevisionNotes.trim() || `Revised from ${editingWorker.wage_rate}`,
          }
        } else {
          history.push({
            effective_from: effKey,
            wage_type: wageType,
            wage_rate: newRate,
            notes: wageRevisionNotes.trim() || `Revised from ${editingWorker.wage_rate}`,
          })
        }
      }

      const isLeaving = workerStatus === 'left' || workerStatus === 'inactive'
      const finalLeftDate = isLeaving ? (leftDate.trim() || new Date().toISOString().split('T')[0]) : undefined

      const updated = workers.map((w) =>
        w.id === editingWorker.id
          ? {
              ...w,
              name: name.trim(),
              phone: phone.trim(),
              role: finalRole,
              wage_type: wageType,
              wage_rate: newRate,
              wage_history: history.length > 0 ? history : w.wage_history,
              shift: shift,
              assigned_machine: machine.trim() || undefined,
              joined_date: joinedDate,
              left_date: finalLeftDate,
              status: workerStatus,
            }
          : w
      )
      saveWorkers(updated)
      setEditingWorker(null)
    } else {
      const isLeaving = workerStatus === 'left' || workerStatus === 'inactive'
      const newWorker: Worker = {
        id: 'w-' + Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        role: finalRole,
        wage_type: wageType,
        wage_rate: newRate,
        wage_history: [
          {
            effective_from: joinedDate || '2025-01-01',
            wage_type: wageType,
            wage_rate: newRate,
            notes: 'Initial onboard wage',
          },
        ],
        shift: shift,
        assigned_machine: machine.trim() || undefined,
        joined_date: joinedDate,
        left_date: isLeaving ? (leftDate.trim() || new Date().toISOString().split('T')[0]) : undefined,
        status: workerStatus,
      }
      saveWorkers([...workers, newWorker])
      setIsAddOpen(false)
    }
  }

  // Safe Worker Archive (Never erase past payroll & passbook records!)
  const handleDeleteWorker = (w: Worker) => {
    const hasHistory =
      attendanceRecords.some((a) => a.worker_id === w.id) ||
      salaryPayments.some((p) => p.worker_id === w.id) ||
      logs.some((l) => l.worker_id === w.id)

    if (hasHistory) {
      const confirmed = window.confirm(
        `Worker "${w.name}" has recorded attendance, passbook vouchers, or production logs.\n\n` +
        `To keep your past accounts, salary sheets, and vouchers 100% accurate, they will be archived as "Left / Resigned".\n\n` +
        `They will be removed from today's active floor attendance, but all their past records will remain accessible anytime in the "Left Staff" tab.\n\n` +
        `Proceed to mark as Left?`
      )
      if (!confirmed) return
      const todayStr = new Date().toISOString().split('T')[0]
      const updated = workers.map((item) =>
        item.id === w.id
          ? {
              ...item,
              status: 'left' as const,
              left_date: item.left_date || todayStr,
            }
          : item
      )
      saveWorkers(updated)
    } else {
      const confirmed = window.confirm(
        `Permanently remove worker "${w.name}" from your system?\n(This worker has 0 recorded attendance or vouchers).`
      )
      if (!confirmed) return
      saveWorkers(workers.filter((item) => item.id !== w.id))
    }
  }

  // Quick Reactivate / Rejoin Floor
  const handleReactivateWorker = (w: Worker) => {
    const confirmed = window.confirm(
      `Reactivate worker "${w.name}" and return them to the active factory floor roster?`
    )
    if (!confirmed) return
    const updated = workers.map((item) =>
      item.id === w.id
        ? {
            ...item,
            status: 'active' as const,
            left_date: undefined,
          }
        : item
    )
    saveWorkers(updated)
  }

  // --- QUICK UPAAD (ADVANCE / KHARCHA) MODAL ---
  const handleOpenQuickUpaad = (w: Worker) => {
    setQuickUpaadWorker(w)
    setUpaadAmount(1000)
    setUpaadMode('Cash')
    setUpaadDate(attendanceDate || new Date().toISOString().split('T')[0])
    setUpaadNotes('Weekly Advance (Kharcha)')
  }

  const handleSaveQuickUpaad = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickUpaadWorker) return

    const amt = Number(upaadAmount) || 0
    if (amt <= 0) return

    const paymentDate = upaadDate || attendanceDate || new Date().toISOString().split('T')[0]
    const derivedMonth = paymentDate.slice(0, 7)

    const newPayment: WorkerSalaryPayment = {
      id: 'sal-' + Date.now(),
      worker_id: quickUpaadWorker.id,
      worker_name: quickUpaadWorker.name,
      month: derivedMonth,
      amount: amt,
      payment_date: paymentDate,
      payment_mode: upaadMode,
      payment_type: 'Advance',
      notes: upaadNotes.trim() || 'Worker Advance / Kharcha',
    }

    saveSalaryPayments([newPayment, ...salaryPayments])
    setQuickUpaadWorker(null)
  }

  const handleDeletePayment = (paymentId: string) => {
    const p = salaryPayments.find((item) => item.id === paymentId)
    const confirmed = window.confirm(
      `Delete advance of ₹${p?.amount?.toLocaleString('en-IN') || ''} for ${p?.worker_name || 'worker'}?\n\nThis will restore their payable salary balance.`
    )
    if (!confirmed) return
    saveSalaryPayments(salaryPayments.filter((item) => item.id !== paymentId))
  }

  // --- SALARY PAYOUT SAVE ---
  const handleOpenPaySalary = (w: Worker, balanceDue: number) => {
    setPayingWorker(w)
    setPayAmount(balanceDue > 0 ? balanceDue : '')
    setPayDate(new Date().toISOString().split('T')[0])
    setPayType('Salary')
    setPayMode('Cash')
    setPayNotes(`Full/Partial settlement for ${salaryMonth}`)
  }

  const handleSaveSalaryPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingWorker) return

    const amt = Number(payAmount) || 0
    if (amt <= 0) return

    const newPayment: WorkerSalaryPayment = {
      id: 'sal-' + Date.now(),
      worker_id: payingWorker.id,
      worker_name: payingWorker.name,
      month: salaryMonth,
      amount: amt,
      payment_date: payDate,
      payment_mode: payMode,
      payment_type: payType,
      notes: payNotes.trim() || undefined,
    }

    saveSalaryPayments([newPayment, ...salaryPayments])
    setPayingWorker(null)
  }

  // --- SHIFT LOG SAVE ---
  const handleSaveShiftLog = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loggingWorker) return

    const pcs = Number(logPieces) || 0
    const rate = Number(logRate) || 0

    const newLog: WorkerShiftLog = {
      id: 'log-' + Date.now(),
      worker_id: loggingWorker.id,
      worker_name: loggingWorker.name,
      lot_number: logLot.trim() || 'General Floor',
      garment_part: logPart.trim() || 'Full Suit',
      pieces_completed: pcs,
      piece_rate: rate,
      total_earned: pcs * rate,
      shift_date: logDate,
      shift_type: logShift,
    }

    saveShiftLogs([newLog, ...logs])
    setLoggingWorker(null)
    setActiveTab('logs')
  }

  // --- MONTHLY SALARY SUMMARY CALCULATOR ---
  // Accurately supports Double Machine (2.0 P) and 1.5 Machine days!
  const salarySummary = useMemo(() => {
    const [yearStr, monthStr] = salaryMonth.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthEnd = `${salaryMonth}-${String(daysInMonth).padStart(2, '0')}`
    const monthStart = `${salaryMonth}-01`

    // Human-readable previous month label (e.g. "Oct 2026", "Nov 2026")
    const prevDate = new Date(year, month - 2, 1)
    const prevMonthLabel = prevDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })

    // Only workers who joined on or before the end of this month appear in salary calculation!
    // Workers who have left also appear in any month when they worked, or if they have an active or carried balance
    const eligibleWorkersForMonth = workers.filter((w) => {
      if (w.joined_date && w.joined_date > monthEnd) return false
      if (w.left_date && w.left_date < monthStart) {
        const hasMonthAttendance = attendanceRecords.some((a) => a.worker_id === w.id && a.date.startsWith(salaryMonth))
        const hasMonthPayments = salaryPayments.some((p) => p.worker_id === w.id && (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth))))
        const hasPastActivity =
          attendanceRecords.some((a) => a.worker_id === w.id && a.date < monthStart) ||
          salaryPayments.some((p) => p.worker_id === w.id && ((p.payment_date && p.payment_date < monthStart) || p.month < salaryMonth))

        if (!hasMonthAttendance && !hasMonthPayments && !hasPastActivity) {
          return false
        }
      }
      return true
    })

    return eligibleWorkersForMonth.map((w) => {
      // Audit-proof wage resolution for this specific month!
      const effectiveWage = getWorkerWageForMonth(w, salaryMonth)
      const effectiveRate = effectiveWage.wage_rate
      const effectiveType = effectiveWage.wage_type

      // 1. Gather attendance for this month
      const monthRecords = attendanceRecords.filter(
        (a) => a.worker_id === w.id && a.date.startsWith(salaryMonth)
      )

      // Total Shift Units / Hajiri (e.g. 1.0, 1.5, 2.0, 0.5)
      const totalShiftUnits = monthRecords.reduce((sum, a) => {
        return sum + getEffectiveShiftUnits(a)
      }, 0)

      const doubleMachineDays = monthRecords.filter((a) => getEffectiveShiftUnits(a) >= 2.0).length
      const oneAndHalfDays = monthRecords.filter((a) => getEffectiveShiftUnits(a) === 1.5).length
      const singleMachineDays = monthRecords.filter((a) => getEffectiveShiftUnits(a) === 1.0).length
      const halfDays = monthRecords.filter((a) => getEffectiveShiftUnits(a) === 0.5).length
      const absentCount = monthRecords.filter((a) => a.status === 'absent').length
      const holidayCount = monthRecords.filter((a) => a.status === 'holiday').length
      const totalOtHours = monthRecords.reduce((sum, a) => sum + (Number(a.overtime_hours) || 0), 0)

      // Pre-joining days calculation for workers who joined during this month
      let preJoiningDays = 0
      if (w.joined_date && w.joined_date.startsWith(salaryMonth)) {
        const joinDay = parseInt(w.joined_date.split('-')[2], 10)
        preJoiningDays = Math.max(0, joinDay - 1)
      }

      // Per Day wage calculation:
      // For monthly workers, divided strictly by actual days in the month (31, 30, 28, or 29)
      const perDayRate = effectiveType === 'monthly' ? effectiveRate / daysInMonth : effectiveRate

      // Overtime Pay calculation: 1.5x of standard hourly rate (perDayRate / 8 hours)
      const hourlyRate = perDayRate / 8
      const otEarnings = Math.round(totalOtHours * (hourlyRate * 1.5))

      // Base Earnings calculation: Uses totalShiftUnits (2.0 machine days multiply by 2!)
      let baseEarned = 0
      if (effectiveType === 'monthly' || effectiveType === 'daily') {
        baseEarned = Math.round(totalShiftUnits * perDayRate)
      }

      // 2. Piece rate shift logs for this worker in this month
      const workerMonthLogs = logs.filter(
        (l) => l.worker_id === w.id && l.shift_date.startsWith(salaryMonth)
      )
      const pieceEarnings = workerMonthLogs.reduce((sum, l) => sum + (Number(l.total_earned) || 0), 0)

      const grossEarned = baseEarned + otEarnings + pieceEarnings

      // 3. Payments / Advances made in this month
      const workerMonthPayments = salaryPayments.filter(
        (p) =>
          p.worker_id === w.id &&
          (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth)))
      )
      const totalPaid = workerMonthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const totalAdvances = workerMonthPayments
        .filter((p) => p.payment_type === 'Advance')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

      // Current month net (Gross - Paid)
      const currentMonthNet = grossEarned - totalPaid

      // 4. PREVIOUS MONTH(S) CARRIED BALANCE CALCULATION
      // Inherits opening balance from all shifts, pieces, and advances prior to salaryMonth
      const pastAttendance = attendanceRecords.filter(
        (a) => a.worker_id === w.id && a.date < monthStart
      )
      const pastShiftEarnings = pastAttendance.reduce((sum, a) => {
        const units = getEffectiveShiftUnits(a)
        if (units <= 0) return sum
        const recMonth = a.date.slice(0, 7)
        const [ry, rm] = recMonth.split('-')
        const pastDaysInMonth = new Date(parseInt(ry, 10), parseInt(rm, 10), 0).getDate() || 30
        const pastWage = getWorkerWageForMonth(w, recMonth)
        const pastPerDay = pastWage.wage_type === 'monthly' ? pastWage.wage_rate / pastDaysInMonth : pastWage.wage_rate
        return sum + Math.round(units * pastPerDay)
      }, 0)

      const pastPieceLogs = logs.filter(
        (l) => l.worker_id === w.id && l.shift_date < monthStart
      )
      const pastPieceEarnings = pastPieceLogs.reduce((sum, l) => sum + (Number(l.total_earned) || 0), 0)
      const pastGrossEarned = pastShiftEarnings + pastPieceEarnings

      const pastPayments = salaryPayments.filter((p) => {
        if (p.worker_id !== w.id) return false
        if (p.payment_date) return p.payment_date < monthStart
        return p.month < salaryMonth
      })
      const pastTotalPaid = pastPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

      // Previous balance carried forward into this month
      const previousBalance = Math.round(pastGrossEarned - pastTotalPaid)

      // Total Balance Due: Inherits previous month balance + current month net!
      const balanceDue = previousBalance + currentMonthNet

      return {
        worker: w,
        effectiveWageRate: effectiveRate,
        effectiveWageType: effectiveType,
        daysInMonth,
        prevMonthLabel,
        preJoiningDays,
        perDayRate,
        totalShiftUnits,
        doubleMachineDays,
        oneAndHalfDays,
        singleMachineDays,
        halfDays,
        absentCount,
        holidayCount,
        totalOtHours,
        daysWorked: totalShiftUnits,
        baseEarned,
        otEarnings,
        pieceEarnings,
        grossEarned,
        totalAdvances,
        totalPaid,
        currentMonthNet,
        previousBalance,
        balanceDue,
        paymentsList: workerMonthPayments,
      }
    })
  }, [workers, attendanceRecords, salaryPayments, logs, salaryMonth])

  // Monthly aggregate totals across all workers
  const monthlyTotalGross = useMemo(() => {
    return salarySummary.reduce((sum, s) => sum + s.grossEarned, 0)
  }, [salarySummary])

  const monthlyTotalPaid = useMemo(() => {
    return salarySummary.reduce((sum, s) => sum + s.totalPaid, 0)
  }, [salarySummary])

  const monthlyTotalPrevBalance = useMemo(() => {
    return salarySummary.reduce((sum, s) => sum + s.previousBalance, 0)
  }, [salarySummary])

  const monthlyFinalNet = useMemo(() => {
    return monthlyTotalGross - monthlyTotalPaid + monthlyTotalPrevBalance
  }, [monthlyTotalGross, monthlyTotalPaid, monthlyTotalPrevBalance])

  // Today's attendance records (strictly for workers eligible on this date)
  const todaysRecords = attendanceRecords.filter(
    (a) => a.date === attendanceDate && eligibleWorkersToday.some((w) => w.id === a.worker_id)
  )

  // Total machine shifts running on the floor today (e.g. 8 staff running 10.5 machine shifts)
  const todaysTotalShiftUnits = todaysRecords.reduce((sum, a) => sum + getEffectiveShiftUnits(a), 0)
  const todaysPresentWorkers = todaysRecords.filter((a) => getEffectiveShiftUnits(a) > 0).length
  const todaysAbsent = todaysRecords.filter((a) => a.status === 'absent').length
  const todaysOtHours = todaysRecords.reduce((sum, a) => sum + (Number(a.overtime_hours) || 0), 0)

  // Total Upaad (Advances) given on the selected attendanceDate
  const todaysAdvances = useMemo(() => {
    return salaryPayments.filter(
      (p) => p.payment_type === 'Advance' && p.payment_date === attendanceDate
    )
  }, [salaryPayments, attendanceDate])

  const todaysTotalUpaadAmount = useMemo(() => {
    return todaysAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  }, [todaysAdvances])

  // Profile data for selected worker
  const selectedProfileHisaab = useMemo(() => {
    if (!selectedProfileWorker) return null
    return salarySummary.find((s) => s.worker.id === selectedProfileWorker.id) || null
  }, [selectedProfileWorker, salarySummary])

  const selectedProfilePayments = useMemo(() => {
    if (!selectedProfileWorker) return []
    return salaryPayments.filter((p) => p.worker_id === selectedProfileWorker.id)
  }, [selectedProfileWorker, salaryPayments])

  // Unique machines for station filter
  const uniqueStations = useMemo(() => {
    const set = new Set<string>()
    workers.forEach((w) => {
      if (w.assigned_machine) set.add(w.assigned_machine)
    })
    return Array.from(set)
  }, [workers])

  // Filtered workers for Daily Attendance
  const filteredAttendanceWorkers = useMemo(() => {
    return eligibleWorkersToday.filter((w) => {
      const q = search.toLowerCase()
      const matchesSearch =
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.role.toLowerCase().includes(q) ||
        (w.assigned_machine && w.assigned_machine.toLowerCase().includes(q))

      const matchesRole = roleFilter === 'all' || w.role === roleFilter
      const matchesShift = shiftFilter === 'all' || w.shift === shiftFilter
      const matchesStation = stationFilter === 'all' || w.assigned_machine === stationFilter

      return matchesSearch && matchesRole && matchesShift && matchesStation
    })
  }, [eligibleWorkersToday, search, roleFilter, shiftFilter, stationFilter])

  // Filtered workers for Staff Roster tab (Supports Active vs Left / Resigned filter)
  const filteredRosterWorkers = useMemo(() => {
    return workers.filter((w) => {
      const q = search.toLowerCase()
      const matchesSearch =
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.role.toLowerCase().includes(q) ||
        (w.assigned_machine && w.assigned_machine.toLowerCase().includes(q))

      const matchesRole = roleFilter === 'all' || w.role === roleFilter
      const matchesShift = shiftFilter === 'all' || w.shift === shiftFilter
      const matchesStation = stationFilter === 'all' || w.assigned_machine === stationFilter

      const isLeft = w.status === 'left' || w.status === 'inactive'
      const matchesStatus =
        rosterStatusFilter === 'all'
          ? true
          : rosterStatusFilter === 'active'
          ? !isLeft
          : isLeft

      return matchesSearch && matchesRole && matchesShift && matchesStation && matchesStatus
    })
  }, [workers, search, roleFilter, shiftFilter, stationFilter, rosterStatusFilter])

  // Date Navigation for Attendance
  const handleShiftDate = (days: number) => {
    const current = new Date(attendanceDate)
    current.setDate(current.getDate() + days)
    setAttendanceDate(current.toISOString().split('T')[0])
  }

  // Selected worker details for Hisaab Slip
  const currentHisaab = useMemo(() => {
    if (!hisaabSlipWorker) return null
    return salarySummary.find((s) => s.worker.id === hisaabSlipWorker.id) || null
  }, [hisaabSlipWorker, salarySummary])

  // Helper for role color badge
  const getRoleBadgeClass = (r: string) => {
    const low = r.toLowerCase()
    if (low.includes('master') || low.includes('supervisor')) {
      return 'bg-purple-50 text-purple-700 border-purple-200'
    }
    if (low.includes('operator')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
    if (low.includes('cutter') || low.includes('dora')) {
      return 'bg-amber-50 text-amber-800 border-amber-200'
    }
    if (low.includes('sequins') || low.includes('cording')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }
    if (low.includes('designer') || low.includes('punching')) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* ================= PAGE HEADER & CONTROLS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Factory Floor Staff & Machine Attendance
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Real-time daily machine attendance, 2-machine double present support, customizable roles, and automated monthly salary hisaab.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsManageRolesOpen(true)}
            className="shadow-xs text-xs bg-white hover:bg-gray-50"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Edit Roles
          </Button>

          <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700 shadow-xs text-xs sm:text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* ================= TOP INDUSTRY KPI INTELLIGENCE CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Active Floor Staff */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Floor Karigars</p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{eligibleWorkersToday.length}</span>
            <span className="text-xs text-gray-400">on duty as of today</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-2xs text-gray-500">
            <span className="inline-flex items-center gap-0.5 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
              <Sun className="w-3 h-3" /> {workers.filter((w) => w.shift === 'Day' && w.status === 'active').length} Day
            </span>
            <span className="inline-flex items-center gap-0.5 text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
              <Moon className="w-3 h-3" /> {workers.filter((w) => w.shift === 'Night' && w.status === 'active').length} Night
            </span>
          </div>
        </div>

        {/* Card 2: Today's Machine Output Shifts */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Machine Shifts Running</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{todaysTotalShiftUnits}</span>
            <span className="text-xs text-gray-500 font-medium">
              Shifts Worked Today ({todaysPresentWorkers} staff)
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-2xs">
            {todaysAbsent > 0 ? (
              <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded font-semibold border border-red-100">
                {todaysAbsent} Absent
              </span>
            ) : (
              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-100">
                All Active Karigars Present
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Monthly Wages Accrued */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gross Wages Accrued</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 font-mono">
              {formatCurrency(monthlyTotalGross)}
            </span>
          </div>
          <p className="text-2xs text-gray-400 mt-2">Earned across month based on machine shifts & piece logs</p>
        </div>

        {/* Card 4: Net Balance Due / Advance Baki (Inherits Previous Month Balance!) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {monthlyFinalNet >= 0 ? 'Net Salary Due (Baki)' : 'Net Advances Overdrawn (उपाड बाकी)'}
            </p>
            <div className={`p-2 rounded-lg ${monthlyFinalNet >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${monthlyFinalNet >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
              {monthlyFinalNet < 0 ? `-${formatCurrency(Math.abs(monthlyFinalNet))}` : formatCurrency(monthlyFinalNet)}
            </span>
            <span className="text-2xs font-semibold text-gray-400">
              {monthlyFinalNet >= 0 ? 'payable' : 'in advance'}
            </span>
          </div>
          <p className="text-2xs text-gray-400 mt-2 font-mono">
            Gross {formatCurrency(monthlyTotalGross)} − Paid {formatCurrency(monthlyTotalPaid)}
            {monthlyTotalPrevBalance !== 0 && (
              <span className={`ml-1 font-bold ${monthlyTotalPrevBalance < 0 ? 'text-amber-600' : 'text-indigo-600'}`}>
                {monthlyTotalPrevBalance < 0 ? ` − Prev ${formatCurrency(Math.abs(monthlyTotalPrevBalance))}` : ` + Prev ${formatCurrency(monthlyTotalPrevBalance)}`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ================= PRIMARY NAVIGATION TABS ================= */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-gray-100 p-1.5 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'attendance'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Daily Attendance (हाजिरी)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('salary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'salary'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <DollarSign className="w-4 h-4 text-indigo-600" />
          <span>Salary & Upaad Hisaab</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'roster'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <Users className="w-4 h-4 text-purple-600" />
          <span>Staff Roster ({workers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'logs'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Piece-Rate Shift Logs ({logs.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          <div className="animate-spin h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
          Loading factory floor staff...
        </div>
      ) : activeTab === 'attendance' ? (
        /* ================= TAB 1: DAILY ATTENDANCE & OT SHEET ================= */
        <div className="space-y-6">
          {/* Date Selector & Fast Shift Bulk Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleShiftDate(-1)} className="h-9 w-9 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="font-bold text-gray-900 h-9 w-44 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => handleShiftDate(1)} className="h-9 w-9 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                className="h-9 text-xs"
              >
                Today
              </Button>

              {todaysTotalUpaadAmount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 font-mono shadow-2xs"
                  title={`${todaysAdvances.length} advances recorded on ${formatDate(attendanceDate)}`}
                >
                  <Wallet className="w-3.5 h-3.5 text-amber-600" />
                  <span>Today's Upaad: ₹{todaysTotalUpaadAmount.toLocaleString('en-IN')}</span>
                  <span className="text-2xs font-normal text-amber-700">({todaysAdvances.length} staff)</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => handleMarkAllPresent('Day')}
                size="sm"
                variant="outline"
                className="h-9 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                title="Mark all active Day Shift workers present (1.0 shift)"
              >
                <Sun className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Mark Day Shift Present
              </Button>

              <Button
                onClick={() => handleMarkAllPresent('Night')}
                size="sm"
                variant="outline"
                className="h-9 text-xs text-indigo-800 border-indigo-300 hover:bg-indigo-50"
                title="Mark all active Night Shift workers present (1.0 shift)"
              >
                <Moon className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Mark Night Shift Present
              </Button>

              <Button
                onClick={() => handleMarkAllPresent()}
                size="sm"
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Check className="w-4 h-4 mr-1" />
                Mark All Present
              </Button>
            </div>
          </div>

          {/* Attendance Table Filter Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search staff, machine, or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs h-9 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Shift Filter */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setShiftFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      shiftFilter === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    All Shifts
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('Day')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                      shiftFilter === 'Day' ? 'bg-amber-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Sun className="w-3 h-3" /> Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('Night')}
                    className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                      shiftFilter === 'Night' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Moon className="w-3 h-3" /> Night
                  </button>
                </div>

                {/* Machine / Station Filter */}
                {uniqueStations.length > 0 && (
                  <select
                    value={stationFilter}
                    onChange={(e) => setStationFilter(e.target.value)}
                    className="h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Machines / Stations</option>
                    {uniqueStations.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                )}

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Roles</option>
                  {rolesList.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Attendance Table */}
            {filteredAttendanceWorkers.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-700">No Active Staff for {formatDate(attendanceDate)}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  Staff only appear on or after their recorded joining date. Check the date filter or staff joining dates in the roster.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3.5">Staff Name & Machine</th>
                      <th className="px-5 py-3.5">Role & Shift</th>
                      <th className="px-5 py-3.5 text-center">
                        <span className="block">Mark Attendance</span>
                        <span className="text-2xs text-gray-400 font-normal lowercase">
                          (1.0 single &bull; 1.5 &bull; 2.0 double machine)
                        </span>
                      </th>
                      <th className="px-5 py-3.5 text-center">Daily Status</th>
                      <th className="px-5 py-3.5 text-center">Quick Upaad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAttendanceWorkers.map((w) => {
                      const record = getAttendanceForWorker(w.id, attendanceDate)
                      const status = record?.status || 'unmarked'
                      const effectiveUnits = getEffectiveShiftUnits(record)
                      const otHours = record?.overtime_hours || 0

                      return (
                        <tr key={w.id} className="hover:bg-gray-50/75 transition-colors">
                          {/* Worker Name & Machine */}
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => setSelectedProfileWorker(w)}
                              className="font-bold text-gray-900 hover:text-indigo-600 text-left hover:underline block"
                              title="Click to view Worker Profile & Passbook"
                            >
                              {w.name}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-2xs text-gray-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-gray-400" />
                                {w.assigned_machine || 'General Floor'}
                              </span>
                            </div>
                          </td>

                          {/* Role & Shift */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(
                                w.role
                              )}`}
                            >
                              {w.role}
                            </span>
                            <div className="mt-1 flex items-center gap-1.5">
                              {w.shift === 'Night' ? (
                                <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                  <Moon className="w-2.5 h-2.5" /> Night Shift
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  <Sun className="w-2.5 h-2.5" /> Day Shift
                                </span>
                              )}
                              <span className="text-2xs text-gray-400">
                                {formatCurrency(w.wage_rate)} / {w.wage_type === 'piece_rate' ? 'piece' : w.wage_type}
                              </span>
                            </div>
                          </td>

                          {/* Interactive Attendance Toggle Pills: Includes 1.5 and 2.0 Double Machine! */}
                          <td className="px-5 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg shadow-2xs">
                              {/* Absent (0) */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'absent', 0, 0)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  status === 'absent'
                                    ? 'bg-rose-600 text-white shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200'
                                }`}
                                title="Absent (0 Shifts)"
                              >
                                A
                              </button>

                              {/* Half Day (0.5) */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'half_day', 0.5, otHours)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  effectiveUnits === 0.5 && status === 'half_day'
                                    ? 'bg-sky-600 text-white shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200'
                                }`}
                                title="Half Day (0.5 Present)"
                              >
                                0.5 HD
                              </button>

                              {/* 1.0 Present: Single Machine Full Day */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'present', 1.0, otHours)}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                  effectiveUnits === 1.0 && status === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                    : 'text-gray-600 hover:bg-gray-200'
                                }`}
                                title="1.0 Present (Single Machine Full Day)"
                              >
                                1.0 P
                              </button>

                              {/* 1.5 Present: 1 Full Day + 2nd Machine Half Day */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'present', 1.5, otHours)}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                  effectiveUnits === 1.5
                                    ? 'bg-indigo-600 text-white shadow-xs scale-105 font-mono'
                                    : 'text-indigo-700 hover:bg-indigo-100 bg-indigo-50/70'
                                }`}
                                title="1.5 Present (1 Machine Full Day + 2nd Machine Half Day)"
                              >
                                1.5 P
                              </button>

                              {/* 2.0 Present: DOUBLE MACHINE OPERATOR (2 Full Machines Ran!) */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'present', 2.0, otHours)}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                  effectiveUnits >= 2.0
                                    ? 'bg-purple-700 text-white shadow-xs scale-105 font-mono'
                                    : 'text-purple-700 hover:bg-purple-100 bg-purple-50/70 font-semibold'
                                }`}
                                title="2.0 Present (Double Machine - Operator Ran 2 Full Machines!)"
                              >
                                2.0 2P
                              </button>

                              {/* Holiday / Factory Off */}
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(w.id, 'holiday', 0, 0)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  status === 'holiday'
                                    ? 'bg-slate-700 text-white shadow-xs scale-105'
                                    : 'text-gray-400 hover:bg-gray-200'
                                }`}
                                title="Holiday / Factory Off"
                              >
                                OFF
                              </button>
                            </div>
                          </td>

                          {/* Daily Status Badge: Accurately reflects 2.0 and 1.5 shifts! */}
                          <td className="px-5 py-3.5 text-center">
                            {effectiveUnits >= 2.0 ? (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-md text-xs font-bold font-mono">
                                2.0 P (Double Machine)
                              </span>
                            ) : effectiveUnits === 1.5 ? (
                              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-md text-xs font-bold font-mono">
                                1.5 P (1.5 Machine)
                              </span>
                            ) : effectiveUnits === 1.0 && status === 'present' ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-bold font-mono">
                                1.0 P (Single Machine)
                              </span>
                            ) : effectiveUnits === 0.5 && status === 'half_day' ? (
                              <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-xs font-bold font-mono">
                                0.5 P (Half Day)
                              </span>
                            ) : status === 'absent' ? (
                              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-bold">
                                Absent
                              </span>
                            ) : status === 'holiday' ? (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                Off
                              </span>
                            ) : (
                              <span className="text-2xs text-gray-400 italic">Unmarked</span>
                            )}
                          </td>

                          {/* Quick Upaad (Advance) Button & Live Indicators */}
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {/* Live indicator if worker received upaad today or this month */}
                              {(() => {
                                const workerTodayUpaad = salaryPayments
                                  .filter(
                                    (p) =>
                                      p.worker_id === w.id &&
                                      p.payment_date === attendanceDate &&
                                      p.payment_type === 'Advance'
                                  )
                                  .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

                                const workerMonthUpaad = salaryPayments
                                  .filter(
                                    (p) =>
                                      p.worker_id === w.id &&
                                      (p.month === attendanceDate.slice(0, 7) ||
                                        (p.payment_date && p.payment_date.startsWith(attendanceDate.slice(0, 7)))) &&
                                      p.payment_type === 'Advance'
                                  )
                                  .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

                                return (
                                  <>
                                    {workerTodayUpaad > 0 ? (
                                      <span
                                        className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-2xs font-mono inline-flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-amber-200"
                                        onClick={() => setSelectedProfileWorker(w)}
                                        title={`Today's Upaad: ₹${workerTodayUpaad.toLocaleString('en-IN')}. Click to view passbook.`}
                                      >
                                        <Wallet className="w-2.5 h-2.5 text-amber-700" />
                                        Today: ₹{workerTodayUpaad.toLocaleString('en-IN')}
                                      </span>
                                    ) : workerMonthUpaad > 0 ? (
                                      <span
                                        className="text-2xs text-gray-500 font-mono cursor-pointer hover:text-gray-700"
                                        onClick={() => setSelectedProfileWorker(w)}
                                        title={`Month Upaad: ₹${workerMonthUpaad.toLocaleString('en-IN')}. Click to view passbook.`}
                                      >
                                        Mo: ₹{workerMonthUpaad.toLocaleString('en-IN')}
                                      </span>
                                    ) : null}
                                  </>
                                )
                              })()}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenQuickUpaad(w)}
                                className="h-7 text-2xs px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                title="Give Advance / Kharcha"
                              >
                                <Wallet className="w-3 h-3 mr-1 text-indigo-600" />
                                + Upaad
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'salary' ? (
        /* ================= TAB 2: GIVE SALARY & UPAAD HISAAB ================= */
        <div className="space-y-6">
          {/* Month Selector Bar & Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="salary-month-select" className="text-xs font-bold uppercase text-gray-500">
                Salary Month:
              </Label>
              <Input
                id="salary-month-select"
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="font-bold text-gray-900 h-9 w-44 text-sm"
              />
              <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-mono">
                {salarySummary[0]?.daysInMonth || 30} Days in Month
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                <span className="text-gray-600">Current Month Gross:</span>
                <span className="ml-1.5 font-bold font-mono text-base text-blue-700">
                  {formatCurrency(monthlyTotalGross)}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                <span className="text-gray-600">Month Upaad Deducted:</span>
                <span className="ml-1.5 font-bold font-mono text-base text-amber-700">
                  {formatCurrency(monthlyTotalPaid)}
                </span>
              </div>
              {monthlyTotalPrevBalance !== 0 && (
                <div
                  className={`px-3 py-1.5 rounded-lg border ${
                    monthlyTotalPrevBalance < 0
                      ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-950'
                  }`}
                >
                  <span className="text-2xs font-semibold uppercase tracking-wider block">
                    Prev Carried ({salarySummary[0]?.prevMonthLabel}):
                  </span>
                  <span className="font-bold font-mono text-base">
                    {monthlyTotalPrevBalance < 0
                      ? `-${formatCurrency(Math.abs(monthlyTotalPrevBalance))}`
                      : `+${formatCurrency(monthlyTotalPrevBalance)}`}
                  </span>
                </div>
              )}
              <div
                className={`px-3 py-1.5 rounded-lg border ${
                  monthlyFinalNet >= 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <span className="text-gray-600">
                  {monthlyFinalNet >= 0 ? 'Net Payable Balance:' : 'Net Advance Excess:'}
                </span>
                <span
                  className={`ml-1.5 font-bold font-mono text-base ${
                    monthlyFinalNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {monthlyFinalNet < 0
                    ? `-${formatCurrency(Math.abs(monthlyFinalNet))}`
                    : formatCurrency(monthlyFinalNet)}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Statement Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Monthly Worker Salary Sheet & Advance Register — {salaryMonth}
                </h3>
                <p className="text-xs text-gray-500">
                  Automated hisaab calculated from machine shifts worked (including 2.0 double machine days & 1.5 machine days), piece work logs, and advance deductions.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Staff Member</th>
                    <th className="px-6 py-3.5">Role & Wage</th>
                    <th className="px-6 py-3.5 text-center">Shifts Worked (Hajiri)</th>
                    <th className="px-6 py-3.5 text-right">Gross Earned (₹)</th>
                    <th className="px-6 py-3.5 text-right">Upaad / Paid (₹)</th>
                    <th className="px-6 py-3.5 text-right">Balance Due (₹)</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salarySummary.map((item) => {
                    const w = item.worker
                    return (
                      <tr key={w.id} className="hover:bg-gray-50/75 transition-colors">
                        {/* Worker Name */}
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedProfileWorker(w)}
                            className="font-bold text-gray-900 hover:text-indigo-600 text-left hover:underline text-sm block"
                            title="Click to view Worker Profile & Passbook"
                          >
                            {w.name}
                          </button>
                          {w.phone && (
                            <span className="text-2xs text-gray-400 font-mono block mt-0.5">
                              {w.phone}
                            </span>
                          )}
                        </td>

                        {/* Role & Wage */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(
                              w.role
                            )}`}
                          >
                            {w.role}
                          </span>
                          <div className="text-2xs text-gray-600 mt-1">
                            {w.wage_type === 'monthly' ? (
                              <div>
                                <span className="font-semibold text-gray-900">
                                  {formatCurrency(w.wage_rate)} / mo
                                </span>
                                <span className="block text-indigo-700 font-mono font-medium">
                                  ÷ {item.daysInMonth} days = ₹{Math.round(item.perDayRate)}/day
                                </span>
                              </div>
                            ) : w.wage_type === 'daily' ? (
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(w.wage_rate)} / day
                              </span>
                            ) : (
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(w.wage_rate)} / pc
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Shifts Worked (Hajiri) - Displays 2.0 and 1.5 breakdown! */}
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-gray-900 text-sm font-mono">
                            {item.totalShiftUnits} Hajiri
                          </span>
                          <p className="text-2xs text-gray-500 mt-0.5">
                            {item.doubleMachineDays > 0 && (
                              <span className="text-purple-700 font-bold font-mono">
                                {item.doubleMachineDays} × 2P (Double)&bull;{' '}
                              </span>
                            )}
                            {item.oneAndHalfDays > 0 && (
                              <span className="text-indigo-700 font-bold font-mono">
                                {item.oneAndHalfDays} × 1.5P &bull;{' '}
                              </span>
                            )}
                            <span>{item.singleMachineDays} × 1P</span>
                            {item.halfDays > 0 && <span> &bull; {item.halfDays} × 0.5P</span>}
                          </p>
                          {w.wage_type === 'piece_rate' ? (
                            <span className="text-2xs text-indigo-600 font-medium block mt-0.5">
                              {item.pieceEarnings > 0
                                ? `= ${formatCurrency(item.pieceEarnings)} (Piece work)`
                                : 'Piece Rate (Logs se banegi)'}
                            </span>
                          ) : (
                            <span className="text-2xs text-emerald-700 font-mono font-medium block mt-0.5">
                              = {formatCurrency(item.baseEarned)}
                            </span>
                          )}
                        </td>

                        {/* Gross Earned */}
                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                          {formatCurrency(item.grossEarned)}
                        </td>

                        {/* Advances / Upaad Paid */}
                        <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-600">
                          {formatCurrency(item.totalPaid)}
                          {item.paymentsList.length > 0 && (
                            <span className="text-2xs text-gray-400 block font-normal">
                              ({item.paymentsList.length} vouchers)
                            </span>
                          )}
                        </td>

                        {/* Balance Due (Negative if Upaad > Gross, inherits previous month balance) */}
                        <td className="px-6 py-4 text-right">
                          {item.balanceDue < 0 ? (
                            <div>
                              <span className="font-mono font-bold text-base text-rose-600 block">
                                -{formatCurrency(Math.abs(item.balanceDue))}
                              </span>
                              <span className="text-2xs font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                                Advance Overdrawn
                              </span>
                            </div>
                          ) : item.balanceDue > 0 ? (
                            <div>
                              <span className="font-mono font-bold text-base text-emerald-700 block">
                                {formatCurrency(item.balanceDue)}
                              </span>
                              <span className="text-2xs font-semibold text-emerald-700 block mt-0.5">
                                To Pay
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-base text-gray-400">₹0</span>
                          )}

                          {/* Distinct indicator showing inherited previous month calculation */}
                          {item.previousBalance !== 0 && (
                            <div className="mt-1">
                              <span
                                className={`text-2xs px-1.5 py-0.5 rounded font-mono font-semibold inline-block border ${
                                  item.previousBalance < 0
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                }`}
                                title={`Inherited from ${item.prevMonthLabel}: ${
                                  item.previousBalance < 0
                                    ? `-${formatCurrency(Math.abs(item.previousBalance))} (Advance)`
                                    : `+${formatCurrency(item.previousBalance)} (Unpaid)`
                                }`}
                              >
                                Prev {item.prevMonthLabel}:{' '}
                                {item.previousBalance < 0
                                  ? `-${formatCurrency(Math.abs(item.previousBalance))}`
                                  : `+${formatCurrency(item.previousBalance)}`}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions: Give Salary + Quick Upaad + Hisaab Slip */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.balanceDue > 0 ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenPaySalary(w, item.balanceDue)}
                                className="h-8 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                                Pay
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPaySalary(w, 0)}
                                className="h-8 text-xs px-2 text-gray-500 border-gray-200 hover:bg-gray-50"
                                title="Worker has excess advance / settled"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                                Settle
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenQuickUpaad(w)}
                              className="h-8 text-xs px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                              title="Give Advance / Upaad"
                            >
                              <Wallet className="w-3 h-3 mr-0.5 text-indigo-600" />
                              Upaad
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setHisaabSlipWorker(w)}
                              className="h-8 text-xs px-2 text-gray-700 border-gray-300 hover:bg-gray-100"
                              title="Generate printable / WhatsApp Hisaab Slip"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-0.5 text-gray-600" />
                              Hisaab
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= UPAAD (ADVANCES) REGISTER ================= */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/40">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Advances & Upaad Register (उपाड रजिस्टर) — {salaryMonth}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Itemized record of all cash, UPI, and bank advances given to staff. Automatically deducted from monthly salary balances.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 bg-amber-100 text-amber-900 rounded-lg border border-amber-300 font-mono">
                  Month Total: {formatCurrency(
                    salaryPayments
                      .filter(
                        (p) =>
                          p.payment_type === 'Advance' &&
                          (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth)))
                      )
                      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                  )}
                </span>
                {workers.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenQuickUpaad(workers[0])}
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    + Record Upaad
                  </Button>
                )}
              </div>
            </div>

            {salaryPayments.filter(
              (p) =>
                p.payment_type === 'Advance' &&
                (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth)))
            ).length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs">
                <Wallet className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-700">No Upaad / Advances recorded for {salaryMonth}</p>
                <p className="text-2xs text-gray-400 mt-0.5">Click "+ Record Upaad" to log cash or UPI kharcha for any worker.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Worker Name</th>
                      <th className="px-6 py-3">Payment Mode</th>
                      <th className="px-6 py-3">Reason / Note</th>
                      <th className="px-6 py-3 text-right">Advance Amount</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salaryPayments
                      .filter(
                        (p) =>
                          p.payment_type === 'Advance' &&
                          (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth)))
                      )
                      .map((p) => {
                        const targetWorker = workers.find((w) => w.id === p.worker_id)
                        return (
                          <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="px-6 py-3 font-mono text-xs text-gray-700 font-medium">
                              {formatDate(p.payment_date)}
                            </td>
                            <td className="px-6 py-3">
                              {targetWorker ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProfileWorker(targetWorker)}
                                  className="font-bold text-gray-900 hover:text-indigo-600 text-left hover:underline text-xs block"
                                  title="View Worker Profile & Passbook"
                                >
                                  {p.worker_name}
                                </button>
                              ) : (
                                <span className="font-bold text-gray-900 text-xs">{p.worker_name}</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-xs">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200 font-medium">
                                {p.payment_mode === 'Cash'
                                  ? '💵 Cash'
                                  : p.payment_mode === 'UPI'
                                  ? '📱 UPI'
                                  : p.payment_mode}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-xs text-gray-600 italic">
                              {p.notes || 'Weekly Kharcha'}
                            </td>
                            <td className="px-6 py-3 text-right font-mono font-bold text-rose-600 text-sm">
                              -{formatCurrency(p.amount)}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                title="Delete / Cancel this advance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'roster' ? (
        /* ================= TAB 3: STAFF ROSTER & PROFILES ================= */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Search & Filters */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search staff by name, phone, role, machine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Active vs Left / Resigned Toggle */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setRosterStatusFilter('active')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    rosterStatusFilter === 'active'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Active Staff ({workers.filter((w) => w.status !== 'left' && w.status !== 'inactive').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterStatusFilter('left')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    rosterStatusFilter === 'left'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Left / Resigned ({workers.filter((w) => w.status === 'left' || w.status === 'inactive').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterStatusFilter('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    rosterStatusFilter === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All ({workers.length})
                </button>
              </div>

              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value as any)}
                className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Shifts</option>
                <option value="Day">Day Shift</option>
                <option value="Night">Night Shift</option>
                <option value="General">General</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles ({workers.length})</option>
                {rolesList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredRosterWorkers.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              No staff members found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Staff Member</th>
                    <th className="px-6 py-3.5">Role & Shift</th>
                    <th className="px-6 py-3.5">Assigned Station</th>
                    <th className="px-6 py-3.5">Wage Agreement</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRosterWorkers.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Name & Phone */}
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedProfileWorker(w)}
                          className="font-bold text-gray-900 hover:text-indigo-600 text-left hover:underline block"
                          title="Click to view Worker Profile & Passbook"
                        >
                          {w.name}
                        </button>
                        {w.phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {w.phone}
                            </span>
                            <a
                              href={`https://wa.me/91${w.phone.replace(/[^0-9]/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-2xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              <MessageCircle className="w-3 h-3 mr-0.5" /> WhatsApp
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Role & Shift */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeClass(
                            w.role
                          )}`}
                        >
                          {w.role}
                        </span>
                        <div className="mt-1 flex items-center gap-1">
                          {w.shift === 'Night' ? (
                            <span className="text-2xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              🌙 Night Shift
                            </span>
                          ) : (
                            <span className="text-2xs font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              ☀️ Day Shift
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Station */}
                      <td className="px-6 py-4 text-xs text-gray-700 font-medium">
                        {w.assigned_machine ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {w.assigned_machine}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Wage Agreement */}
                      <td className="px-6 py-4 font-mono font-bold text-gray-900 text-xs">
                        {formatCurrency(w.wage_rate)}{' '}
                        <span className="text-2xs text-gray-400 font-normal">
                          / {w.wage_type === 'piece_rate' ? 'piece' : w.wage_type}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                            w.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.status === 'on_leave'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {w.status === 'left' ? 'Left / Resigned' : w.status.replace('_', ' ')}
                        </span>
                        {w.left_date && (
                          <span className="block text-3xs text-rose-600 font-mono mt-0.5">
                            Left {formatDate(w.left_date)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedProfileWorker(w)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors"
                            title="View Worker Profile & Passbook"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(w)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors"
                            title="Edit Worker Profile & Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLoggingWorker(w)
                              setLogPieces(100)
                              setLogRate(w.wage_type === 'piece_rate' ? w.wage_rate : 5)
                            }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-gray-100 transition-colors"
                            title="Log Shift Pieces (Dora Cutting / Embroidery)"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          {w.status === 'left' || w.status === 'inactive' ? (
                            <button
                              type="button"
                              onClick={() => handleReactivateWorker(w)}
                              className="px-2 py-1 text-2xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded font-bold transition-colors flex items-center gap-1"
                              title="Reactivate worker and return to floor"
                            >
                              <Check className="w-3 h-3" /> Rejoin Floor
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteWorker(w)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Safely Archive Worker (Mark as Left)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= TAB 4: PIECE-RATE SHIFT LOGS ================= */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Piece Work Production Logs</h3>
              <p className="text-xs text-gray-500">
                Log completed units (e.g. Dora cutting, sequins, finishing pieces) per worker shift. Automatically added to monthly gross earnings.
              </p>
            </div>
            {workers.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setLoggingWorker(workers[0])
                  setLogPieces(100)
                  setLogRate(5)
                }}
                className="bg-indigo-600 hover:bg-indigo-700 shadow-xs text-xs"
              >
                <Plus className="w-4 h-4 mr-1" /> Log Shift Pieces
              </Button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Clock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              No piece work logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Date & Shift</th>
                    <th className="px-6 py-3.5">Worker Name</th>
                    <th className="px-6 py-3.5">Lot / Job Reference</th>
                    <th className="px-6 py-3.5">Garment Part</th>
                    <th className="px-6 py-3.5 text-center">Pieces Done</th>
                    <th className="px-6 py-3.5 text-right">Rate / Pc</th>
                    <th className="px-6 py-3.5 text-right">Total Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-3.5 text-xs text-gray-700">
                        <span className="font-bold text-gray-900 block">{formatDate(log.shift_date)}</span>
                        <span className="text-2xs text-gray-400">{log.shift_type} Shift</span>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-gray-900">{log.worker_name}</td>
                      <td className="px-6 py-3.5 text-xs text-indigo-700 font-semibold">{log.lot_number}</td>
                      <td className="px-6 py-3.5 text-xs text-gray-700">{log.garment_part}</td>
                      <td className="px-6 py-3.5 text-center font-mono font-bold text-gray-900">
                        {log.pieces_completed.toLocaleString('en-IN')} pcs
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs">₹{log.piece_rate} / pc</td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(log.total_earned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: ADD / EDIT WORKER ================= */}
      <Modal
        isOpen={isAddOpen || Boolean(editingWorker)}
        onClose={() => {
          setIsAddOpen(false)
          setEditingWorker(null)
        }}
        title={editingWorker ? 'Edit Worker Profile & Role' : 'Add New Factory Worker'}
      >
        <form onSubmit={handleSaveWorker} className="space-y-4">
          <div>
            <Label htmlFor="worker-name">Worker Full Name *</Label>
            <Input
              id="worker-name"
              placeholder="e.g. Ramesh Bhai (Operator)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="worker-phone">Phone / WhatsApp Number</Label>
              <Input
                id="worker-phone"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Joining Date Field - Critical Industry Requirement */}
            <div>
              <Label htmlFor="worker-joined-date">Joining Date *</Label>
              <Input
                id="worker-joined-date"
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                required
                className="mt-1 font-semibold"
              />
              <p className="text-2xs text-gray-400 mt-1">
                Worker only appears in attendance on/after this date.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customizable Worker Role */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="worker-role">Worker Role *</Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsManageRolesOpen(true)}
                    className="text-2xs text-gray-500 hover:text-indigo-600 font-medium"
                    title="Add, rename, or delete preset roles"
                  >
                    Edit List
                  </button>
                  <span className="text-gray-300 text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomRole(!isCustomRole)}
                    className="text-2xs text-indigo-600 hover:underline font-semibold"
                  >
                    {isCustomRole ? 'Choose Preset Role' : '+ Custom Role'}
                  </button>
                </div>
              </div>

              {isCustomRole ? (
                <Input
                  id="custom-worker-role"
                  placeholder="e.g. Sequins Karigar / Bobbin Master"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="mt-1 font-medium text-indigo-900"
                  required
                />
              ) : (
                <select
                  id="worker-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {rolesList.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Shift Assignment */}
            <div>
              <Label htmlFor="worker-shift">Assigned Shift *</Label>
              <select
                id="worker-shift"
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="Day">☀️ Day Shift (8:00 AM - 8:00 PM)</option>
                <option value="Night">🌙 Night Shift (8:00 PM - 8:00 AM)</option>
                <option value="General">General / Flexible Shift</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wage-type">Salary / Wage Basis *</Label>
              <select
                id="wage-type"
                value={wageType}
                onChange={(e) => setWageType(e.target.value as Worker['wage_type'])}
                className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="monthly">Monthly Fixed Salary</option>
                <option value="daily">Daily Wage (Dihadi)</option>
                <option value="piece_rate">Piece Rate (Per Stitched/Cut Pc)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="wage-rate">
                {wageType === 'monthly'
                  ? 'Monthly Salary (₹)'
                  : wageType === 'daily'
                  ? 'Daily Rate (₹/day)'
                  : 'Piece Rate (₹/piece)'}{' '}
                *
              </Label>
              <FormattedNumberInput
                id="wage-rate"
                value={wageRate}
                onChange={(val) => setWageRate(val)}
                required
                className="mt-1"
              />
            </div>
          </div>

          {editingWorker && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    Salary Revision Effective Month:
                  </span>
                  <p className="text-2xs text-indigo-700 mt-0.5">
                    Audit Safety: Months prior to this will keep their original wage calculation.
                  </p>
                </div>
                <input
                  type="month"
                  value={wageEffectiveMonth}
                  onChange={(e) => setWageEffectiveMonth(e.target.value)}
                  className="h-8 px-2.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-indigo-950 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="worker-machine">Assigned Machine / Station</Label>
              <Input
                id="worker-machine"
                placeholder="e.g. Machine #1 (Multi-Head), Finishing Table"
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="worker-status">Status *</Label>
              <select
                id="worker-status"
                value={workerStatus}
                onChange={(e) => setWorkerStatus(e.target.value as Worker['status'])}
                className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="active">Active (On Duty)</option>
                <option value="on_leave">On Leave</option>
                <option value="left">Left / Resigned (भूतपूर्व कारीगर)</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {(workerStatus === 'left' || workerStatus === 'inactive') && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5">
              <Label htmlFor="worker-left-date" className="text-rose-950 font-bold">
                Leaving Date (Last Working Day) *
              </Label>
              <Input
                id="worker-left-date"
                type="date"
                value={leftDate}
                onChange={(e) => setLeftDate(e.target.value)}
                className="mt-1 bg-white"
                required
              />
              <p className="text-2xs text-rose-700">
                Worker will be safely archived. All historical attendance, salary sheets, and passbooks remain preserved forever.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddOpen(false)
                setEditingWorker(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              {editingWorker ? 'Save Changes' : 'Save Worker'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 2: QUICK UPAAD (ADVANCE / KHARCHA) ================= */}
      {quickUpaadWorker && (
        <Modal
          isOpen={Boolean(quickUpaadWorker)}
          onClose={() => setQuickUpaadWorker(null)}
          title={`Give Advance (Upaad / Kharcha) — ${quickUpaadWorker.name}`}
        >
          <form onSubmit={handleSaveQuickUpaad} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-950">{quickUpaadWorker.name}</p>
                <p className="text-2xs text-amber-700 mt-0.5">
                  Role: {quickUpaadWorker.role} &bull; Base: {formatCurrency(quickUpaadWorker.wage_rate)} /{' '}
                  {quickUpaadWorker.wage_type}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold bg-white px-2.5 py-1 rounded text-amber-800 border border-amber-300 font-mono block">
                  Month Upaad: ₹{
                    salaryPayments
                      .filter(
                        (p) =>
                          p.worker_id === quickUpaadWorker.id &&
                          p.payment_type === 'Advance' &&
                          (p.month === salaryMonth || (p.payment_date && p.payment_date.startsWith(salaryMonth)))
                      )
                      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                      .toLocaleString('en-IN')
                  }
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <Label className="text-xs text-gray-500">Quick Amount Select</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[500, 1000, 1500, 2000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setUpaadAmount(preset)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold font-mono transition-all border ${
                      Number(upaadAmount) === preset
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="upaad-amount">Advance Amount (₹) *</Label>
              <FormattedNumberInput
                id="upaad-amount"
                value={upaadAmount}
                onChange={(val) => setUpaadAmount(val)}
                required
                className="mt-1 font-bold text-lg text-amber-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="upaad-date">Payment Date *</Label>
                <Input
                  id="upaad-date"
                  type="date"
                  value={upaadDate}
                  onChange={(e) => setUpaadDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="upaad-mode">Payment Mode *</Label>
                <select
                  id="upaad-mode"
                  value={upaadMode}
                  onChange={(e) => setUpaadMode(e.target.value as any)}
                  className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              <div>
                <Label htmlFor="upaad-notes">Reason / Note</Label>
                <Input
                  id="upaad-notes"
                  placeholder="e.g. Grocery, Doctor, Weekly Kharcha"
                  value={upaadNotes}
                  onChange={(e) => setUpaadNotes(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setQuickUpaadWorker(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                <Wallet className="w-3.5 h-3.5 mr-1" />
                Record Upaad (Advance)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL 3: PAY SALARY ================= */}
      {payingWorker && (
        <Modal
          isOpen={Boolean(payingWorker)}
          onClose={() => setPayingWorker(null)}
          title={`Disburse Salary — ${payingWorker.name}`}
        >
          <form onSubmit={handleSaveSalaryPayment} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-950">{payingWorker.name}</p>
                <p className="text-2xs text-emerald-700 mt-0.5">
                  Role: {payingWorker.role} &bull; Base: {formatCurrency(payingWorker.wage_rate)} /{' '}
                  {payingWorker.wage_type}
                </p>
              </div>
              <span className="text-xs font-bold bg-white px-2.5 py-1 rounded text-emerald-800 border border-emerald-300 font-mono">
                Month: {salaryMonth}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-amount">Disbursement Amount (₹) *</Label>
                <FormattedNumberInput
                  id="pay-amount"
                  value={payAmount}
                  onChange={(val) => setPayAmount(val)}
                  required
                  className="mt-1 font-bold text-lg text-emerald-900"
                />
              </div>

              <div>
                <Label htmlFor="pay-date">Payment Date *</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-type">Payment Type *</Label>
                <select
                  id="pay-type"
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as any)}
                  className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <option value="Salary">Full/Partial Salary Settlement</option>
                  <option value="Advance">Advance (Kharcha / Upaad)</option>
                  <option value="Bonus">Festival Bonus</option>
                  <option value="Overtime">Overtime Payout</option>
                </select>
              </div>

              <div>
                <Label htmlFor="pay-mode">Payment Mode *</Label>
                <select
                  id="pay-mode"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Cheque">📜 Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="pay-notes">Notes / Voucher Reference</Label>
              <Input
                id="pay-notes"
                placeholder="e.g. Month-end final settlement, cash receipt #12"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setPayingWorker(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Check className="w-4 h-4 mr-1" />
                Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL 4: HISAAB SLIP (SALARY & UPAAD VOUCHER) ================= */}
      {hisaabSlipWorker && currentHisaab && (
        <Modal
          isOpen={Boolean(hisaabSlipWorker)}
          onClose={() => setHisaabSlipWorker(null)}
          title="Worker Salary & Upaad Hisaab Voucher (वेतन हिसाब चिट्ठी)"
        >
          <div className="space-y-4">
            {/* The printable Hisaab voucher body */}
            <div id="hisaab-slip-print" className="border-2 border-dashed border-gray-300 rounded-xl p-5 bg-white space-y-4">
              {/* Header */}
              <div className="text-center pb-3 border-b border-gray-200">
                <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">{businessName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  MONTHLY SALARY & ADVANCE SETTLEMENT VOUCHER (वेतन हिसाब चिट्ठी)
                </p>
                {businessPhone && <p className="text-2xs text-gray-400">Phone: {businessPhone}</p>}
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-800 font-mono">
                  <span>Hisaab Month: {salaryMonth}</span>
                  <span>&bull;</span>
                  <span>Slip Date: {formatDate(new Date().toISOString().split('T')[0])}</span>
                </div>
              </div>

              {/* Worker Details Card */}
              <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-gray-400 text-2xs block">Staff Member:</span>
                  <span className="font-bold text-gray-900 text-sm">{hisaabSlipWorker.name}</span>
                  {hisaabSlipWorker.phone && (
                    <span className="text-2xs text-gray-500 block font-mono">{hisaabSlipWorker.phone}</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 text-2xs block">Designation & Shift:</span>
                  <span className="font-bold text-gray-900">{hisaabSlipWorker.role}</span>
                  <span className="text-2xs text-indigo-700 block">
                    {hisaabSlipWorker.shift} Shift &bull; {hisaabSlipWorker.assigned_machine || 'General Station'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-2xs block">Joined Date:</span>
                  <span className="font-semibold text-gray-700">{formatDate(hisaabSlipWorker.joined_date)}</span>
                  {currentHisaab.preJoiningDays > 0 && (
                    <span className="block text-2xs text-amber-700 font-medium">
                      ({currentHisaab.preJoiningDays} pre-joining days unpaid)
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 text-2xs block">Wage Agreement & Month Days:</span>
                  <span className="font-bold text-gray-900 font-mono">
                    {formatCurrency(hisaabSlipWorker.wage_rate)} / {hisaabSlipWorker.wage_type}
                  </span>
                  {hisaabSlipWorker.wage_type === 'monthly' && (
                    <span className="block text-2xs text-indigo-700 font-mono font-bold">
                      ₹{hisaabSlipWorker.wage_rate.toLocaleString('en-IN')} ÷ {currentHisaab.daysInMonth} days = ₹{currentHisaab.perDayRate.toFixed(2)}/day
                    </span>
                  )}
                </div>
              </div>

              {/* Attendance & Machine Shifts Breakdown (Shows 2.0 and 1.5 machine days!) */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  1. Machine Attendance & Shifts Summary (हाजिरी / मशीन शिफ्ट्स)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-50 rounded-md border border-emerald-100">
                    <span className="text-2xs text-emerald-700 block font-medium">1.0 Machine</span>
                    <span className="font-bold text-emerald-900 text-sm">{currentHisaab.singleMachineDays} days</span>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-md border border-purple-100">
                    <span className="text-2xs text-purple-700 block font-medium">2.0 Double Machine</span>
                    <span className="font-bold text-purple-900 text-sm">{currentHisaab.doubleMachineDays} days</span>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-md border border-indigo-100">
                    <span className="text-2xs text-indigo-700 block font-medium">1.5 Machine</span>
                    <span className="font-bold text-indigo-900 text-sm">{currentHisaab.oneAndHalfDays} days</span>
                  </div>
                  <div className="p-2 bg-sky-50 rounded-md border border-sky-100">
                    <span className="text-2xs text-sky-700 block font-medium">Half Day (0.5)</span>
                    <span className="font-bold text-sky-900 text-sm">{currentHisaab.halfDays} days</span>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-md border border-gray-200">
                    <span className="text-2xs text-gray-700 block font-bold">Total Payable Shifts</span>
                    <span className="font-black text-gray-900 text-sm font-mono">{currentHisaab.totalShiftUnits} Hajiri</span>
                  </div>
                </div>
                {currentHisaab.totalOtHours > 0 && (
                  <p className="text-xs text-purple-700 font-semibold mt-1.5">
                    + Overtime Logged: {currentHisaab.totalOtHours} hours
                  </p>
                )}
              </div>

              {/* Earnings Calculation Breakdown */}
              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  2. Gross Earnings (कुल आवक हिसाब)
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">
                      Machine Shifts Wages for {currentHisaab.totalShiftUnits} Hajiri
                      {hisaabSlipWorker.wage_type === 'monthly'
                        ? ` (${currentHisaab.totalShiftUnits} × ₹${currentHisaab.perDayRate.toFixed(2)}/day)`
                        : ` (${currentHisaab.totalShiftUnits} × ₹${hisaabSlipWorker.wage_rate})`}:
                    </span>
                    <span className="font-mono font-bold text-gray-900">{formatCurrency(currentHisaab.baseEarned)}</span>
                  </div>
                  {currentHisaab.otEarnings > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-purple-700">
                      <span>Overtime Pay ({currentHisaab.totalOtHours} hrs @ 1.5x rate):</span>
                      <span className="font-mono font-bold">+{formatCurrency(currentHisaab.otEarnings)}</span>
                    </div>
                  )}
                  {currentHisaab.pieceEarnings > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-indigo-700">
                      <span>Piece Work Logs (Shift Production):</span>
                      <span className="font-mono font-bold">+{formatCurrency(currentHisaab.pieceEarnings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-bold text-gray-900">
                    <span>Total Gross Earned:</span>
                    <span className="font-mono text-sm">{formatCurrency(currentHisaab.grossEarned)}</span>
                  </div>
                </div>
              </div>

              {/* Advances (Upaad / Kharcha Deductions) */}
              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  3. Advances & Upaad Deducted (उपाड / खर्चा कटौती)
                </h4>
                {currentHisaab.paymentsList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No advances or withdrawals taken this month.</p>
                ) : (
                  <div className="space-y-1">
                    {currentHisaab.paymentsList.map((p) => (
                      <div key={p.id} className="flex justify-between text-2xs py-1 border-b border-gray-50">
                        <span className="text-gray-600">
                          {formatDate(p.payment_date)} &bull; {p.payment_mode} &bull; {p.payment_type}{' '}
                          {p.notes ? `(${p.notes})` : ''}
                        </span>
                        <span className="font-mono font-bold text-rose-600">-{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 text-xs font-bold text-rose-700">
                      <span>Total Advances Deducted:</span>
                      <span className="font-mono">-{formatCurrency(currentHisaab.totalPaid)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Previous Month Carried Balance (पूर्व माह शेष हिसाब) */}
              {currentHisaab.previousBalance !== 0 && (
                <div className="border-t border-gray-200 pt-3">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>4. Previous Month Balance (पूर्व माह शेष — {currentHisaab.prevMonthLabel})</span>
                    <span
                      className={`text-2xs px-2 py-0.5 rounded-full font-bold uppercase ${
                        currentHisaab.previousBalance < 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                      }`}
                    >
                      {currentHisaab.previousBalance < 0 ? 'Advance Overdrawn' : 'Unpaid Wages Carried'}
                    </span>
                  </h4>
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      currentHisaab.previousBalance < 0
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">
                        {currentHisaab.previousBalance < 0
                          ? `Previous Advance Overdrawn from ${currentHisaab.prevMonthLabel} (कारीगर पर बकाया उपाड)`
                          : `Previous Unpaid Balance from ${currentHisaab.prevMonthLabel} (पूर्व माह बाकी वेतन)`}
                      </p>
                      <p className="text-2xs text-gray-500 mt-0.5">
                        Closing balance automatically carried over into {salaryMonth}
                      </p>
                    </div>
                    <span
                      className={`font-mono font-bold text-sm ${
                        currentHisaab.previousBalance < 0 ? 'text-amber-700' : 'text-indigo-700'
                      }`}
                    >
                      {currentHisaab.previousBalance < 0
                        ? `-${formatCurrency(Math.abs(currentHisaab.previousBalance))}`
                        : `+${formatCurrency(currentHisaab.previousBalance)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Final Net Balance Box */}
              <div
                className={`p-3 rounded-xl flex items-center justify-between border ${
                  currentHisaab.balanceDue >= 0
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-rose-50 border-rose-300'
                }`}
              >
                <div>
                  <p
                    className={`text-xs uppercase font-extrabold ${
                      currentHisaab.balanceDue >= 0 ? 'text-emerald-950' : 'text-rose-950'
                    }`}
                  >
                    {currentHisaab.balanceDue >= 0
                      ? 'Net Payable Balance (चुकता राशि)'
                      : 'Advance Overdrawn (उपाड बाकी - कारीगर पर बाकी)'}
                  </p>
                  <p className={`text-2xs ${currentHisaab.balanceDue >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {currentHisaab.previousBalance !== 0
                      ? `Gross ${formatCurrency(currentHisaab.grossEarned)} − Paid ${formatCurrency(currentHisaab.totalPaid)} ${
                          currentHisaab.previousBalance < 0
                            ? `− Prev Advance ${formatCurrency(Math.abs(currentHisaab.previousBalance))}`
                            : `+ Prev Wages ${formatCurrency(currentHisaab.previousBalance)}`
                        }`
                      : currentHisaab.balanceDue > 0
                      ? 'Pending Final Handover to Staff'
                      : currentHisaab.balanceDue < 0
                      ? 'Advance exceeds wages earned (to be adjusted next month)'
                      : 'Paid in Full (No balance due)'}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xl font-black font-mono ${
                      currentHisaab.balanceDue >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {currentHisaab.balanceDue < 0
                      ? `-${formatCurrency(Math.abs(currentHisaab.balanceDue))}`
                      : formatCurrency(currentHisaab.balanceDue)}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-gray-300 pt-1">
                  <p className="font-bold text-gray-800">Factory Owner / Master Sign</p>
                  <p className="text-2xs text-gray-400">Approved for Payment</p>
                </div>
                <div className="border-t border-gray-300 pt-1">
                  <p className="font-bold text-gray-800">Worker Signature / Thumb</p>
                  <p className="text-2xs text-gray-400">Acknowledged Receipt</p>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const slipEl = document.getElementById('hisaab-slip-print')
                  if (!slipEl) return
                  window.print()
                }}
                className="text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Hisaab (प्रिंट)
              </Button>

              <div className="flex items-center gap-2">
                {hisaabSlipWorker.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const wageFormula = hisaabSlipWorker.wage_type === 'monthly'
                        ? `₹${hisaabSlipWorker.wage_rate.toLocaleString('en-IN')} ÷ ${currentHisaab.daysInMonth} days = ₹${Math.round(currentHisaab.perDayRate)}/day`
                        : `₹${hisaabSlipWorker.wage_rate}/day`
                      const balanceLine = currentHisaab.balanceDue >= 0
                        ? `*NET PAYABLE BALANCE: ${formatCurrency(currentHisaab.balanceDue)}*`
                        : `*ADVANCE OVERDRAWN: -${formatCurrency(Math.abs(currentHisaab.balanceDue))} (Advance Excess)*`
                      const prevLine = currentHisaab.previousBalance !== 0
                        ? `\n• Previous Balance (${currentHisaab.prevMonthLabel}): ${currentHisaab.previousBalance < 0 ? '-' : '+'}${formatCurrency(Math.abs(currentHisaab.previousBalance))}`
                        : ''
                      const msg = `*SALARY HISAAB SLIP - ${businessName}*\nMonth: ${salaryMonth} (${currentHisaab.daysInMonth} days in month)\nStaff: ${hisaabSlipWorker.name} (${hisaabSlipWorker.role})\nWage: ${wageFormula}${currentHisaab.preJoiningDays > 0 ? `\nJoined: ${formatDate(hisaabSlipWorker.joined_date)} (${currentHisaab.preJoiningDays} pre-joining days unpaid)` : ''}\n---------------------------\n• Total Shifts (Hajiri): ${currentHisaab.totalShiftUnits} shifts (incl. double & 1.5 machine days)\n• Base Wages: ${formatCurrency(currentHisaab.baseEarned)}${currentHisaab.pieceEarnings > 0 ? `\n• Piece Work: ${formatCurrency(currentHisaab.pieceEarnings)}` : ''}\n• Gross Earned: ${formatCurrency(currentHisaab.grossEarned)}\n• Total Upaad (Advance): ${formatCurrency(currentHisaab.totalPaid)}${prevLine}\n---------------------------\n${balanceLine}\nGenerated Date: ${formatDate(new Date().toISOString().split('T')[0])}`
                      window.open(
                        `https://wa.me/91${hisaabSlipWorker.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                          msg
                        )}`,
                        '_blank'
                      )
                    }}
                    className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    WhatsApp Hisaab
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    handleOpenPaySalary(hisaabSlipWorker, currentHisaab.balanceDue)
                    setHisaabSlipWorker(null)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  Pay Balance Now
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL 5: EDIT ROLES PRESETS ================= */}
      {isManageRolesOpen && (
        <Modal
          isOpen={isManageRolesOpen}
          onClose={() => setIsManageRolesOpen(false)}
          title="Manage & Customize Factory Roles"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Add, rename, or remove worker roles specific to your embroidery factory. Renaming updates all assigned workers automatically.
            </p>

            {/* Add new role */}
            <form onSubmit={handleAddRole} className="flex gap-2">
              <Input
                placeholder="e.g. Sequins Master, Folding Boy..."
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                className="text-sm"
              />
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap">
                <Plus className="w-4 h-4 mr-1" /> Add Role
              </Button>
            </form>

            {/* Roles list with inline rename */}
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {rolesList.map((r) => (
                <div key={r} className="p-2.5 flex items-center justify-between hover:bg-gray-50/75 gap-2">
                  {editingRoleOrig === r ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleRenameRole(r, editingRoleValue)
                      }}
                      className="flex-1 flex items-center gap-1.5"
                    >
                      <Input
                        value={editingRoleValue}
                        onChange={(e) => setEditingRoleValue(e.target.value)}
                        className="h-8 text-xs font-medium"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="Save new role name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingRoleOrig(null)}
                        className="h-8 px-2 text-gray-500"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-gray-800">{r}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoleOrig(r)
                            setEditingRoleValue(r)
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                          title="Rename / Edit role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(r)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsManageRolesOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL 6: LOG PIECE WORK (DORA CUTTING / SHIFT WORK) ================= */}
      {loggingWorker && (
        <Modal
          isOpen={Boolean(loggingWorker)}
          onClose={() => setLoggingWorker(null)}
          title={`Log Shift Production Pieces — ${loggingWorker.name}`}
        >
          <form onSubmit={handleSaveShiftLog} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-bold text-amber-950">{loggingWorker.name}</p>
              <p className="text-2xs text-amber-700 mt-0.5">
                Role: {loggingWorker.role} &bull; Wage Type: {loggingWorker.wage_type}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="log-date">Shift Date *</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="log-shift">Shift Type *</Label>
                <select
                  id="log-shift"
                  value={logShift}
                  onChange={(e) => setLogShift(e.target.value as any)}
                  className="w-full mt-1 h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <option value="Day">☀️ Day Shift</option>
                  <option value="Night">🌙 Night Shift</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="log-lot">Lot # / Challan Reference</Label>
                <Input
                  id="log-lot"
                  placeholder="e.g. Lot #740 / CH-740"
                  value={logLot}
                  onChange={(e) => setLogLot(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="log-part">Garment Part</Label>
                <Input
                  id="log-part"
                  placeholder="e.g. Front, Dora Cutting, Dupatta"
                  value={logPart}
                  onChange={(e) => setLogPart(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="log-pieces">Pieces Finished *</Label>
                <FormattedNumberInput
                  id="log-pieces"
                  value={logPieces}
                  onChange={(val) => setLogPieces(val)}
                  required
                  className="mt-1 font-bold text-lg text-indigo-900"
                />
              </div>

              <div>
                <Label htmlFor="log-rate">Rate Per Piece (₹) *</Label>
                <FormattedNumberInput
                  id="log-rate"
                  value={logRate}
                  onChange={(val) => setLogRate(val)}
                  required
                  className="mt-1 font-bold text-lg"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-900">Total Shift Earnings:</span>
              <span className="text-base font-bold font-mono text-emerald-700">
                {formatCurrency((Number(logPieces) || 0) * (Number(logRate) || 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setLoggingWorker(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                Save Shift Log
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL 7: WORKER PROFILE & FINANCIAL PASSBOOK ================= */}
      {selectedProfileWorker && (
        <Modal
          isOpen={Boolean(selectedProfileWorker)}
          onClose={() => setSelectedProfileWorker(null)}
          title={`Worker Profile & Passbook — ${selectedProfileWorker.name}`}
        >
          <div className="space-y-5">
            {/* Header Profile Card */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                  {selectedProfileWorker.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">{selectedProfileWorker.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                        selectedProfileWorker.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {selectedProfileWorker.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-2xs font-semibold border ${getRoleBadgeClass(
                        selectedProfileWorker.role
                      )}`}
                    >
                      {selectedProfileWorker.role}
                    </span>
                    <span className="text-2xs font-medium text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                      {selectedProfileWorker.shift === 'Night' ? '🌙 Night Shift' : '☀️ Day Shift'}
                    </span>
                    <span className="text-2xs text-gray-600 bg-white/80 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5 text-gray-400" />
                      {selectedProfileWorker.assigned_machine || 'General Station'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedProfileWorker.phone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${selectedProfileWorker.phone}`}
                    className="p-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors shadow-2xs"
                    title="Call Karigar"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={`https://wa.me/91${selectedProfileWorker.phone.replace(/[^0-9]/g, '').slice(-10)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              )}
            </div>

            {/* Employment & Wage Agreement Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 text-2xs block uppercase tracking-wider font-semibold">Employment Status & Dates</span>
                <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                  Joined: {formatDate(selectedProfileWorker.joined_date)}
                </span>
                {selectedProfileWorker.left_date ? (
                  <span className="text-rose-600 font-bold block text-2xs mt-0.5">
                    Resigned / Left on: {formatDate(selectedProfileWorker.left_date)}
                  </span>
                ) : (
                  <span className="text-2xs text-emerald-700 font-medium block mt-0.5">
                    Active Floor Karigar
                  </span>
                )}
              </div>

              <div>
                <span className="text-gray-400 text-2xs block uppercase tracking-wider font-semibold">Active Wage Agreement</span>
                <span className="font-bold text-gray-900 font-mono text-sm mt-0.5 block">
                  {formatCurrency(selectedProfileHisaab?.effectiveWageRate || selectedProfileWorker.wage_rate)} / {
                    (selectedProfileHisaab?.effectiveWageType || selectedProfileWorker.wage_type) === 'piece_rate'
                      ? 'piece'
                      : (selectedProfileHisaab?.effectiveWageType || selectedProfileWorker.wage_type)
                  }
                </span>
                {(selectedProfileHisaab?.effectiveWageType || selectedProfileWorker.wage_type) === 'monthly' && (
                  <span className="text-2xs text-indigo-700 font-mono block mt-0.5 font-medium">
                    {new Date(salaryMonth + '-01').toLocaleString('en-IN', { month: 'short', year: 'numeric' })}: ₹{
                      (selectedProfileHisaab?.effectiveWageRate || selectedProfileWorker.wage_rate).toLocaleString('en-IN')
                    } ÷ {selectedProfileHisaab?.daysInMonth || 30} days = ₹{
                      Math.round((selectedProfileHisaab?.effectiveWageRate || selectedProfileWorker.wage_rate) / (selectedProfileHisaab?.daysInMonth || 30))
                    }/day
                  </span>
                )}
              </div>

              {/* Historical Wage Revision Timeline */}
              {selectedProfileWorker.wage_history && selectedProfileWorker.wage_history.length > 1 && (
                <div className="sm:col-span-2 pt-2 border-t border-gray-200">
                  <span className="text-2xs uppercase tracking-wider font-bold text-gray-500 block mb-1">
                    Wage Revision History (वेतन संशोधन इतिहास):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {selectedProfileWorker.wage_history.map((rev, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-2xs bg-white p-1.5 rounded border border-gray-200"
                      >
                        <span className="text-gray-600 font-medium">
                          From {rev.effective_from.slice(0, 7)}:
                        </span>
                        <span className="font-mono font-bold text-gray-900">
                          {formatCurrency(rev.wage_rate)} / {rev.wage_type === 'piece_rate' ? 'pc' : rev.wage_type}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-3xs text-gray-400 mt-1">
                    Calculations in past months remain strictly locked to the wage applicable in that month.
                  </p>
                </div>
              )}
            </div>

            {/* Month Stats Summary */}
            {selectedProfileHisaab && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Month Summary ({new Date(salaryMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })} &bull; {selectedProfileHisaab.daysInMonth} Days)
                  </h4>
                  <span className="text-2xs text-gray-500 font-medium">
                    Active Month Data
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <span className="text-2xs text-indigo-700 block font-medium">Shifts Worked</span>
                    <span className="font-black text-indigo-950 text-base font-mono">
                      {selectedProfileHisaab.totalShiftUnits} Hajiri
                    </span>
                    <span className="text-2xs text-indigo-600 block">
                      {selectedProfileHisaab.doubleMachineDays > 0 ? `${selectedProfileHisaab.doubleMachineDays} × 2P` : 'Single Machine'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                    <span className="text-2xs text-blue-700 block font-medium">Gross Earned</span>
                    <span className="font-black text-blue-950 text-base font-mono">
                      {formatCurrency(selectedProfileHisaab.grossEarned)}
                    </span>
                    <span className="text-2xs text-blue-600 block">
                      {new Date(salaryMonth + '-01').toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-2xs text-amber-800 block font-medium">Advances (Upaad)</span>
                    <span className="font-black text-amber-950 text-base font-mono">
                      {formatCurrency(selectedProfileHisaab.totalPaid)}
                    </span>
                    <span className="text-2xs text-amber-700 block">
                      {new Date(salaryMonth + '-01').toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-2xs text-purple-800 block font-medium">
                    Prev Carried ({selectedProfileHisaab.prevMonthLabel})
                  </span>
                  <span
                    className={`font-black text-base font-mono ${
                      selectedProfileHisaab.previousBalance < 0
                        ? 'text-amber-700'
                        : selectedProfileHisaab.previousBalance > 0
                        ? 'text-purple-900'
                        : 'text-gray-500'
                    }`}
                  >
                    {selectedProfileHisaab.previousBalance < 0
                      ? `-${formatCurrency(Math.abs(selectedProfileHisaab.previousBalance))}`
                      : selectedProfileHisaab.previousBalance > 0
                      ? `+${formatCurrency(selectedProfileHisaab.previousBalance)}`
                      : '₹0'}
                  </span>
                  <span className="text-2xs text-purple-700 block">
                    {selectedProfileHisaab.previousBalance < 0
                      ? 'Advance Baki'
                      : selectedProfileHisaab.previousBalance > 0
                      ? 'Salary Due'
                      : 'Settled'}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedProfileHisaab.balanceDue >= 0
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <span
                    className={`text-2xs block font-medium ${
                      selectedProfileHisaab.balanceDue >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {selectedProfileHisaab.balanceDue >= 0 ? 'Net Due (Baki)' : 'Advance Excess'}
                  </span>
                  <span
                    className={`font-black text-base font-mono ${
                      selectedProfileHisaab.balanceDue >= 0 ? 'text-emerald-900' : 'text-rose-700'
                    }`}
                  >
                    {selectedProfileHisaab.balanceDue < 0
                      ? `-${formatCurrency(Math.abs(selectedProfileHisaab.balanceDue))}`
                      : formatCurrency(selectedProfileHisaab.balanceDue)}
                  </span>
                  <span
                    className={`text-2xs block ${
                      selectedProfileHisaab.balanceDue >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {selectedProfileHisaab.balanceDue >= 0 ? 'Payable Balance' : 'Karigar owes'}
                  </span>
                </div>
              </div>
            </div>
          )}

            {/* Financial Passbook / Payout History (उपाड व वेतन खाता) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-600" />
                  Financial Passbook / Upaad Ledger (उपाड व वेतन खाता)
                </h4>
                <Button
                  size="sm"
                  onClick={() => {
                    handleOpenQuickUpaad(selectedProfileWorker)
                  }}
                  className="h-7 text-2xs px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  + Give Upaad
                </Button>
              </div>

              {selectedProfilePayments.length === 0 && (!selectedProfileHisaab || selectedProfileHisaab.previousBalance === 0) ? (
                <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-400">
                  <Wallet className="w-6 h-6 mx-auto text-gray-300 mb-1" />
                  No advances or salary disbursements recorded yet for {selectedProfileWorker.name}.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-2xs uppercase font-semibold text-gray-500 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Mode</th>
                        <th className="px-3 py-2">Notes</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedProfileHisaab && selectedProfileHisaab.previousBalance !== 0 && (
                        <tr className="bg-amber-50/70 font-medium">
                          <td className="px-3 py-2 font-mono text-gray-700">1st of Month</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-2xs font-bold border ${
                                selectedProfileHisaab.previousBalance < 0
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                              }`}
                            >
                              Opening Balance
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">Carried Over</td>
                          <td className="px-3 py-2 text-gray-700 italic max-w-xs truncate">
                            Inherited from {selectedProfileHisaab.prevMonthLabel} hisaab
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {selectedProfileHisaab.previousBalance < 0 ? (
                              <span className="text-amber-700">
                                -{formatCurrency(Math.abs(selectedProfileHisaab.previousBalance))}
                              </span>
                            ) : (
                              <span className="text-indigo-700">
                                +{formatCurrency(selectedProfileHisaab.previousBalance)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-400 text-2xs">System</td>
                        </tr>
                      )}
                      {selectedProfilePayments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                          <td className="px-3 py-2 font-mono text-gray-700">{formatDate(p.payment_date)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-2xs font-semibold ${
                                p.payment_type === 'Advance'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {p.payment_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {p.payment_mode === 'Cash' ? '💵 Cash' : p.payment_mode === 'UPI' ? '📱 UPI' : p.payment_mode}
                          </td>
                          <td className="px-3 py-2 text-gray-500 italic max-w-xs truncate">{p.notes || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                            {p.payment_type === 'Advance' ? (
                              <span className="text-rose-600">-{formatCurrency(p.amount)}</span>
                            ) : (
                              <span className="text-emerald-600">+{formatCurrency(p.amount)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Delete Payment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleOpenEdit(selectedProfileWorker)
                  setSelectedProfileWorker(null)
                }}
                className="text-xs"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Edit Profile
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHisaabSlipWorker(selectedProfileWorker)
                    setSelectedProfileWorker(null)
                  }}
                  className="text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Receipt className="w-3.5 h-3.5 mr-1" />
                  Hisaab Voucher
                </Button>

                {selectedProfileHisaab && selectedProfileHisaab.balanceDue > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      handleOpenPaySalary(selectedProfileWorker, selectedProfileHisaab.balanceDue)
                      setSelectedProfileWorker(null)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                    Pay Balance ({formatCurrency(selectedProfileHisaab.balanceDue)})
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProfileWorker(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
