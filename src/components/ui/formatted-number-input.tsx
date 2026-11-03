'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string
  onChange: (numericValue: number, formattedString: string) => void
  allowDecimals?: boolean
  prefix?: string
  suffix?: string
}

export function formatToIndian(val: string | number, allowDecimals = true): string {
  if (val === '' || val === undefined || val === null) return ''
  const str = val.toString().replace(/,/g, '')
  if (str === '') return ''

  if (!allowDecimals) {
    const cleanInt = str.replace(/[^0-9]/g, '')
    if (!cleanInt) return ''
    return new Intl.NumberFormat('en-IN').format(Number(cleanInt))
  }

  // Allow decimals
  const clean = str.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (!parts[0] && parts.length === 1) return ''

  const intFormatted = parts[0] ? new Intl.NumberFormat('en-IN').format(Number(parts[0])) : '0'
  return parts.length > 1 ? `${intFormatted}.${parts[1].slice(0, 2)}` : intFormatted
}

export function parseFromIndian(val: string): number {
  if (!val) return 0
  const clean = val.replace(/,/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

export default function FormattedNumberInput({
  value,
  onChange,
  allowDecimals = true,
  prefix,
  suffix,
  className,
  placeholder,
  disabled,
  required,
  ...props
}: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>('')

  useEffect(() => {
    if (value === '' || value === 0 || value === undefined || value === null) {
      if (value === 0) {
        setDisplayValue('0')
      } else {
        setDisplayValue('')
      }
    } else {
      setDisplayValue(formatToIndian(value, allowDecimals))
    }
  }, [value, allowDecimals])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value

    // If empty
    if (!inputVal.trim()) {
      setDisplayValue('')
      onChange(0, '')
      return
    }

    // Strip characters
    let clean = inputVal.replace(/,/g, '')
    if (!allowDecimals) {
      clean = clean.replace(/[^0-9]/g, '')
    } else {
      clean = clean.replace(/[^0-9.]/g, '')
      // prevent multiple decimal points
      const dots = clean.split('.')
      if (dots.length > 2) {
        clean = `${dots[0]}.${dots.slice(1).join('')}`
      }
    }

    if (!clean) {
      setDisplayValue('')
      onChange(0, '')
      return
    }

    // Handle trailing decimal (e.g. user typed "50.")
    const parts = clean.split('.')
    let formatted = ''
    if (parts[0]) {
      formatted = new Intl.NumberFormat('en-IN').format(Number(parts[0]))
    }
    if (parts.length > 1) {
      formatted = `${formatted}.${parts[1]}`
    }

    setDisplayValue(formatted)
    const num = parseFloat(clean)
    onChange(isNaN(num) ? 0 : num, formatted)
  }

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-3.5 text-gray-500 font-semibold text-sm select-none pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          prefix && 'pl-8',
          suffix && 'pr-12',
          className
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3.5 text-gray-400 font-medium text-xs select-none pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
