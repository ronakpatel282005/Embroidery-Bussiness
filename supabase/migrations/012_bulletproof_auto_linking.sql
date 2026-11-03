-- ============================================================
-- Complete All-In-One Schema:
-- 1. Lot Allotments (public.lot_allotments)
-- 2. Allotment Items (public.allotment_items)
-- 3. Factory Payments (public.factory_payments)
-- 4. Bulletproof Multi-Tenant Auto-Linking
-- 5. Cross-Tenant Privacy & Visibility
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. ENSURE LINKED_BUSINESS_ID COLUMNS EXIST ON FACTORIES & VEPARIS
ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES public.businesses(id);
ALTER TABLE public.veparis ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES public.businesses(id);

-- 2. CREATE TABLE PUBLIC.LOT_ALLOTMENTS (IF NOT EXISTS)
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

-- 3. CREATE TABLE PUBLIC.ALLOTMENT_ITEMS (IF NOT EXISTS)
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

-- 4. CREATE TABLE PUBLIC.FACTORY_PAYMENTS (IF NOT EXISTS)
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

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
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

-- 6. HELPER FUNCTION: GET CLEAN 10-DIGIT MOBILE NUMBER
CREATE OR REPLACE FUNCTION public.clean_phone_10(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN p_phone IS NULL THEN NULL
    WHEN length(regexp_replace(p_phone, '[^0-9]', '', 'g')) >= 10 
      THEN RIGHT(regexp_replace(p_phone, '[^0-9]', '', 'g'), 10)
    ELSE NULL
  END;
$$;

-- 7. FUNCTION: FIND REGISTERED BUSINESSES BY PHONE NUMBER
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
  clean_10 TEXT;
BEGIN
  clean_10 := public.clean_phone_10(phone_query);

  IF clean_10 IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT b.id, b.name, b.owner_name, b.address
  FROM public.businesses b
  WHERE public.clean_phone_10(b.phone) = clean_10
    AND b.id != my_business_id();
END;
$$;

-- 8. FUNCTION TO BATCH SYNC ALL UNLINKED FACTORIES AND VEPARIS FOR A BUSINESS
CREATE OR REPLACE FUNCTION public.sync_factory_links(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Auto-link unlinked FACTORIES matching any registered business phone
  UPDATE public.factories f
  SET linked_business_id = b.id
  FROM public.businesses b
  WHERE f.business_id = p_business_id
    AND f.linked_business_id IS NULL
    AND f.is_own = FALSE
    AND public.clean_phone_10(f.phone) IS NOT NULL
    AND public.clean_phone_10(f.phone) = public.clean_phone_10(b.phone)
    AND b.id != p_business_id;

  -- Auto-link unlinked VEPARIS matching any registered business phone
  UPDATE public.veparis v
  SET linked_business_id = b.id
  FROM public.businesses b
  WHERE v.business_id = p_business_id
    AND v.linked_business_id IS NULL
    AND public.clean_phone_10(v.phone) IS NOT NULL
    AND public.clean_phone_10(v.phone) = public.clean_phone_10(b.phone)
    AND b.id != p_business_id;
END;
$$;

-- 9. TRIGGERS: AUTO-LINK ON BUSINESS INSERT OR PHONE UPDATE
CREATE OR REPLACE FUNCTION public.auto_link_on_business_phone_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF public.clean_phone_10(NEW.phone) IS NOT NULL THEN
    UPDATE public.factories f
    SET linked_business_id = NEW.id
    WHERE f.linked_business_id IS NULL
      AND f.is_own = FALSE
      AND public.clean_phone_10(f.phone) = public.clean_phone_10(NEW.phone)
      AND f.business_id != NEW.id;

    UPDATE public.veparis v
    SET linked_business_id = NEW.id
    WHERE v.linked_business_id IS NULL
      AND public.clean_phone_10(v.phone) = public.clean_phone_10(NEW.phone)
      AND v.business_id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_on_business_insert_or_update ON public.businesses;
CREATE TRIGGER trg_auto_link_on_business_insert_or_update
  AFTER INSERT OR UPDATE OF phone ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_business_phone_change();

-- 10. TRIGGERS: AUTO-LINK UPON INSERTING/UPDATING A FACTORY RECORD
CREATE OR REPLACE FUNCTION public.auto_link_factory_on_insert_or_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_match UUID;
BEGIN
  IF NEW.is_own = FALSE AND NEW.linked_business_id IS NULL AND public.clean_phone_10(NEW.phone) IS NOT NULL THEN
    SELECT b.id INTO v_match
    FROM public.businesses b
    WHERE public.clean_phone_10(b.phone) = public.clean_phone_10(NEW.phone)
      AND b.id != NEW.business_id
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      NEW.linked_business_id := v_match;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_factory_on_insert_or_update ON public.factories;
CREATE TRIGGER trg_auto_link_factory_on_insert_or_update
  BEFORE INSERT OR UPDATE OF phone ON public.factories
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_factory_on_insert_or_update();

-- 11. TWO-WAY RLS POLICIES FOR LINKED FACTORIES & PARTNERS
-- Allow linked factory account to see the business name of whoever allotted them work
DROP POLICY IF EXISTS "businesses_linked_view" ON public.businesses;
CREATE POLICY "businesses_linked_view" ON public.businesses
  FOR SELECT
  USING (
    id IN (
      SELECT la.business_id FROM public.lot_allotments la
      JOIN public.factories f ON f.id = la.factory_id
      WHERE f.linked_business_id = my_business_id()
    )
  );

-- Allow linked factory account to view allotments assigned to them
DROP POLICY IF EXISTS "lot_allotments_linked_view" ON public.lot_allotments;
CREATE POLICY "lot_allotments_linked_view" ON public.lot_allotments
  FOR SELECT
  USING (
    factory_id IN (
      SELECT f.id FROM public.factories f WHERE f.linked_business_id = my_business_id()
    )
  );

DROP POLICY IF EXISTS "allotment_items_linked_view" ON public.allotment_items;
CREATE POLICY "allotment_items_linked_view" ON public.allotment_items
  FOR SELECT
  USING (
    allotment_id IN (
      SELECT la.id FROM public.lot_allotments la
      JOIN public.factories f ON f.id = la.factory_id
      WHERE f.linked_business_id = my_business_id()
    )
  );

DROP POLICY IF EXISTS "allotment_items_linked_update" ON public.allotment_items;
CREATE POLICY "allotment_items_linked_update" ON public.allotment_items
  FOR UPDATE
  USING (
    allotment_id IN (
      SELECT la.id FROM public.lot_allotments la
      JOIN public.factories f ON f.id = la.factory_id
      WHERE f.linked_business_id = my_business_id()
    )
  );

-- 12. RUN RETROACTIVE FIX FOR ALL CURRENT FACTORIES & VEPARIS RIGHT NOW!
UPDATE public.factories f
SET linked_business_id = b.id
FROM public.businesses b
WHERE f.linked_business_id IS NULL
  AND f.is_own = FALSE
  AND public.clean_phone_10(f.phone) IS NOT NULL
  AND public.clean_phone_10(f.phone) = public.clean_phone_10(b.phone)
  AND b.id != f.business_id;

UPDATE public.veparis v
SET linked_business_id = b.id
FROM public.businesses b
WHERE v.linked_business_id IS NULL
  AND public.clean_phone_10(v.phone) IS NOT NULL
  AND public.clean_phone_10(v.phone) = public.clean_phone_10(b.phone)
  AND b.id != v.business_id;

-- 13. PERMISSIONS & SCHEMA CACHE RELOAD
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.clean_phone_10(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.sync_factory_links(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_businesses_by_phone(TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
