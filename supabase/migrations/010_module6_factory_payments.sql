-- ============================================================
-- Module 6: Factory Ledgers & Payments Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

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

ALTER TABLE public.factory_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_payments_own" ON public.factory_payments;
CREATE POLICY "factory_payments_own" ON public.factory_payments
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
