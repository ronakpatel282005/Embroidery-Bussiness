import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatIndianNumber(val: number | string): string {
  if (val === '' || val === undefined || val === null) return ''
  const clean = val.toString().replace(/,/g, '')
  if (clean === '') return ''
  const parts = clean.split('.')
  const intVal = Number(parts[0])
  if (isNaN(intVal)) return ''
  const integerFormatted = new Intl.NumberFormat('en-IN').format(intVal)
  return parts.length > 1 ? `${integerFormatted}.${parts[1]}` : integerFormatted
}

export function parseCleanNumber(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = val.toString().replace(/,/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}
