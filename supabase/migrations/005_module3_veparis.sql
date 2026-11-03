-- ============================================================
-- Module 3: Veparis & Payments Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- VEAPARIS TABLE
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

-- AUTO-UPDATE updated_at TRIGGER
DROP TRIGGER IF EXISTS veparis_updated_at ON public.veparis;
CREATE TRIGGER veparis_updated_at
  BEFORE UPDATE ON public.veparis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ENABLE RLS
ALTER TABLE public.veparis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veparis_own" ON public.veparis;
CREATE POLICY "veparis_own" ON public.veparis
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- VEAPARI PAYMENTS TABLE
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

-- ENABLE RLS
ALTER TABLE public.vepari_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vepari_payments_own" ON public.vepari_payments;
CREATE POLICY "vepari_payments_own" ON public.vepari_payments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- GRANTS FOR DATA API ROLES
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
