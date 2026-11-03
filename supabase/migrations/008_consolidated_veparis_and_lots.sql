-- ============================================================
-- Consolidated Schema for Module 3 (Veparis) & Module 4 (Lots)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. VEAPARIS TABLE
CREATE TABLE IF NOT EXISTS public.veparis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  phone               TEXT,
  address             TEXT,
  opening_balance     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  linked_business_id  UUID REFERENCES public.businesses(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS veparis_updated_at ON public.veparis;
CREATE TRIGGER veparis_updated_at
  BEFORE UPDATE ON public.veparis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.veparis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veparis_own" ON public.veparis;
CREATE POLICY "veparis_own" ON public.veparis
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 2. VEAPARI PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.vepari_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  vepari_id     UUID NOT NULL REFERENCES public.veparis(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode  TEXT NOT NULL DEFAULT 'Cash',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vepari_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vepari_payments_own" ON public.vepari_payments;
CREATE POLICY "vepari_payments_own" ON public.vepari_payments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 3. LOTS TABLE
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
  status          TEXT NOT NULL DEFAULT 'received', -- 'received', 'in_progress', 'completed'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS lots_updated_at ON public.lots;
CREATE TRIGGER lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lots_own" ON public.lots;
CREATE POLICY "lots_own" ON public.lots
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 4. LOT ITEMS TABLE (Garment parts included: Top, Plazo, etc.)
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

ALTER TABLE public.lot_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_items_own" ON public.lot_items;
CREATE POLICY "lot_items_own" ON public.lot_items
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- 5. GRANTS FOR DATA API & INSTANT SCHEMA CACHE RELOAD
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
