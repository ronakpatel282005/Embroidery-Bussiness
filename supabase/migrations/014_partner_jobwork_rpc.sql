-- ============================================================
-- Module 5 & 6: Partner Allotments Direct RPC & RLS Unlocking
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. Function for linked factories to fetch all jobs allotted to them by partner designers
CREATE OR REPLACE FUNCTION public.get_assigned_allotments_for_me()
RETURNS TABLE (
  id UUID,
  challan_number TEXT,
  allotment_date DATE,
  expected_delivery_date DATE,
  pricing_type TEXT,
  rate_per_piece NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  status TEXT,
  notes TEXT,
  client_business_id UUID,
  client_name TEXT,
  client_owner TEXT,
  client_phone TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.challan_number,
    la.allotment_date,
    la.expected_delivery_date,
    la.pricing_type,
    la.rate_per_piece,
    la.total_amount,
    la.status,
    la.notes,
    b.id AS client_business_id,
    b.name AS client_name,
    b.owner_name AS client_owner,
    b.phone AS client_phone,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ai.id,
            'work_type_name', ai.work_type_name,
            'pieces', ai.pieces,
            'rate', ai.rate,
            'amount', ai.amount,
            'returned_pieces', ai.returned_pieces
          )
        )
        FROM public.allotment_items ai
        WHERE ai.allotment_id = la.id
      ),
      '[]'::jsonb
    ) AS items
  FROM public.lot_allotments la
  JOIN public.factories f ON f.id = la.factory_id
  JOIN public.businesses b ON b.id = la.business_id
  WHERE f.linked_business_id = my_business_id()
  ORDER BY la.allotment_date DESC;
END;
$$;

-- 2. Unlock RLS on factories so linked businesses can see their linkage
DROP POLICY IF EXISTS "factories_own" ON public.factories;
CREATE POLICY "factories_own" ON public.factories
  FOR ALL
  USING (
    business_id = my_business_id()
    OR
    linked_business_id = my_business_id()
  );

-- 3. Unlock RLS on lot_allotments
DROP POLICY IF EXISTS "lot_allotments_own" ON public.lot_allotments;
DROP POLICY IF EXISTS "lot_allotments_view" ON public.lot_allotments;
CREATE POLICY "lot_allotments_view" ON public.lot_allotments
  FOR ALL
  USING (
    business_id = my_business_id()
    OR
    factory_id IN (
      SELECT f.id FROM public.factories f WHERE f.linked_business_id = my_business_id()
    )
  );

-- 4. Unlock RLS on allotment_items
DROP POLICY IF EXISTS "allotment_items_own" ON public.allotment_items;
DROP POLICY IF EXISTS "allotment_items_view" ON public.allotment_items;
CREATE POLICY "allotment_items_view" ON public.allotment_items
  FOR ALL
  USING (
    business_id = my_business_id()
    OR
    allotment_id IN (
      SELECT la.id FROM public.lot_allotments la
      JOIN public.factories f ON f.id = la.factory_id
      WHERE f.linked_business_id = my_business_id()
    )
  );

-- 5. Unlock RLS on businesses
DROP POLICY IF EXISTS "businesses_own" ON public.businesses;
DROP POLICY IF EXISTS "businesses_view" ON public.businesses;
CREATE POLICY "businesses_view" ON public.businesses
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    id IN (
      SELECT la.business_id FROM public.lot_allotments la
      JOIN public.factories f ON f.id = la.factory_id
      WHERE f.linked_business_id = my_business_id()
    )
  );

GRANT EXECUTE ON FUNCTION public.get_assigned_allotments_for_me() TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
