-- ============================================================
-- Module 4: Lots & Lot Items Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- LOTS TABLE
CREATE TABLE IF NOT EXISTS public.lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  vepari_id       UUID NOT NULL REFERENCES public.veparis(id) ON DELETE RESTRICT,
  lot_number      TEXT NOT NULL,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  design_number   TEXT,
  description     TEXT,
  pricing_type    TEXT NOT NULL DEFAULT 'per_piece', -- 'per_piece' or 'full_lot'
  total_pieces    INTEGER NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status          TEXT NOT NULL DEFAULT 'received', -- 'received', 'in_progress', 'completed', 'delivered'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUTO-UPDATE updated_at TRIGGER
DROP TRIGGER IF EXISTS lots_updated_at ON public.lots;
CREATE TRIGGER lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ENABLE RLS ON LOTS
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lots_own" ON public.lots;
CREATE POLICY "lots_own" ON public.lots
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- LOT ITEMS TABLE (Breakdown by Work Type: Top, Sleeve, etc.)
CREATE TABLE IF NOT EXISTS public.lot_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  lot_id          UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  work_type_id    UUID REFERENCES public.work_types(id) ON DELETE SET NULL,
  work_type_name  TEXT NOT NULL,
  pieces          INTEGER NOT NULL DEFAULT 0,
  rate            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  allotted_pieces INTEGER NOT NULL DEFAULT 0,
  returned_pieces INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ENABLE RLS ON LOT ITEMS
ALTER TABLE public.lot_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_items_own" ON public.lot_items;
CREATE POLICY "lot_items_own" ON public.lot_items
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- GRANTS FOR DATA API ROLES
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
