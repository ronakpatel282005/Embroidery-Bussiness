-- ============================================================
-- Module 5: Lot Allotment & Multi-Company Factory Discovery Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. LOT ALLOTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.lot_allotments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lot_id                  UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  factory_id              UUID NOT NULL REFERENCES public.factories(id) ON DELETE RESTRICT,
  challan_number          TEXT NOT NULL,
  allotment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date  DATE,
  pricing_type            TEXT NOT NULL DEFAULT 'per_piece', -- 'per_piece' or 'full_lot'
  rate_per_piece          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status                  TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'in_progress', 'returned', 'completed'
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS lot_allotments_updated_at ON public.lot_allotments;
CREATE TRIGGER lot_allotments_updated_at
  BEFORE UPDATE ON public.lot_allotments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.lot_allotments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_allotments_own" ON public.lot_allotments;
CREATE POLICY "lot_allotments_own" ON public.lot_allotments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 2. ALLOTMENT ITEMS TABLE (Tracks pieces of each work type allotted)
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

ALTER TABLE public.allotment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allotment_items_own" ON public.allotment_items;
CREATE POLICY "allotment_items_own" ON public.allotment_items
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 3. FUNCTION TO DISCOVER REGISTERED BUSINESSES BY PHONE NUMBER
-- Safely queries across businesses for discovery, returning only public profile info
CREATE OR REPLACE FUNCTION public.find_businesses_by_phone(phone_query TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_name TEXT,
  address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  clean_query TEXT;
BEGIN
  clean_query := regexp_replace(phone_query, '[^0-9]', '', 'g');
  -- If prefixed with India 91 (e.g. 919825112345), grab last 10 digits
  IF length(clean_query) > 10 AND clean_query LIKE '91%' THEN
    clean_query := substr(clean_query, 3);
  END IF;

  RETURN QUERY
  SELECT b.id, b.name, b.owner_name, b.address
  FROM public.businesses b
  WHERE (
    regexp_replace(b.phone, '[^0-9]', '', 'g') LIKE '%' || clean_query
    OR clean_query LIKE '%' || regexp_replace(b.phone, '[^0-9]', '', 'g')
  )
  AND b.id != my_business_id();
END;
$$;

-- 4. GRANTS FOR DATA API & INSTANT SCHEMA CACHE RELOAD
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_businesses_by_phone(TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
