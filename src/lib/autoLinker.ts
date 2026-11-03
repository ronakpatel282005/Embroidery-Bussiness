import { SupabaseClient } from '@supabase/supabase-js'

export interface LinkableFactory {
  id: string
  name: string
  phone?: string | null
  is_own?: boolean
  linked_business_id?: string | null
  [key: string]: any
}

export interface LinkableVepari {
  id: string
  name: string
  phone?: string | null
  linked_business_id?: string | null
  [key: string]: any
}

/**
 * Normalizes phone numbers to standard 10 digits for accurate matching across India.
 * Handles '+91', '0', spaces, dashes, etc.
 */
export function cleanPhone10(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length >= 10) {
    return digits.slice(-10)
  }
  return null
}

/**
 * Pass-through helper for factories.
 * Account linking is deliberately handled manually via the Edit Factory (✏️) detection card
 * to ensure 100% precision when multiple companies share a phone number.
 */
export async function autoLinkFactories<T extends LinkableFactory>(
  supabase: SupabaseClient,
  businessId: string,
  factories: T[]
): Promise<{ factories: T[]; newlyLinkedCount: number }> {
  return { factories, newlyLinkedCount: 0 }
}

/**
 * Pass-through helper for veparis.
 */
export async function autoLinkVeparis<T extends LinkableVepari>(
  supabase: SupabaseClient,
  businessId: string,
  veparis: T[]
): Promise<{ veparis: T[]; newlyLinkedCount: number }> {
  return { veparis, newlyLinkedCount: 0 }
}
