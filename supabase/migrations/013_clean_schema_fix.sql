-- ============================================================
-- Clean Schema Fix: Lot Allotments, Payments & Phone Lookup
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. Ensure linked_business_id columns exist on factories & veparis
ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES public.businesses(id);
ALTER TABLE public.veparis ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES public.businesses(id);

-- 2. Create public.lot_allotments table (Fixes "Could not find table public.lot_allotments")
CREATE TABLE IF NOT EXISTS public.lot_allotments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lot_id                  UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  factory_id              UUID NOT NULL REFERENCES public.factories(id) ON DELETE RESTRICT,
  challan_number          TEXT NOT NULL,
  allotment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date  DATE,
  pricing_type            TEXT NOT NULL DEFAULT 'per_piece',
  rate_per_piece          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status                  TEXT NOT NULL DEFAULT 'sent',
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create public.allotment_items table
CREATE TABLE IF NOT EXISTS public.allotment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  allotment_id    UUID NOT NULL REFERENCES public.lot_allotments(id) ON DELETE CASCADE,
  lot_item_id     UUID NOT NULL REFERENCES public.lot_items(id) ON DELETE CASCADE,
  work_type_name  TEXT NOT NULL,
  pieces          INTEGER NOT NULL DEFAULT 0,
  rate            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  returned_pieces INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create public.factory_payments table
CREATE TABLE IF NOT EXISTS public.factory_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  factory_id    UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode  TEXT NOT NULL DEFAULT 'Cash',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Row Level Security (RLS)
ALTER TABLE public.lot_allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allotment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_allotments_own" ON public.lot_allotments;
CREATE POLICY "lot_allotments_own" ON public.lot_allotments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

DROP POLICY IF EXISTS "allotment_items_own" ON public.allotment_items;
CREATE POLICY "allotment_items_own" ON public.allotment_items
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

DROP POLICY IF EXISTS "factory_payments_own" ON public.factory_payments;
CREATE POLICY "factory_payments_own" ON public.factory_payments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 6. Phone Lookup Function for Edit Factory (✏️) Detection Card
CREATE OR REPLACE FUNCTION public.find_businesses_by_phone(phone_query TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_name TEXT,
  address TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT b.id, b.name, b.owner_name, b.address
  FROM public.businesses b
  WHERE length(regexp_replace(phone_query, '[^0-9]', '', 'g')) >= 10
    AND length(regexp_replace(b.phone, '[^0-9]', '', 'g')) >= 10
    AND RIGHT(regexp_replace(b.phone, '[^0-9]', '', 'g'), 10) = RIGHT(regexp_replace(phone_query, '[^0-9]', '', 'g'), 10)
    AND b.id != my_business_id();
$$;

-- 7. Grant Permissions & Reload PostgREST Cache
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_businesses_by_phone(TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
