-- ============================================================
-- Auto-Link Offline Factories when a Business Registers Later
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. FUNCTION TO SYNC UNLINKED FACTORIES FOR A BUSINESS
CREATE OR REPLACE FUNCTION public.sync_factory_links(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- For any unlinked factory belonging to p_business_id,
  -- if a registered business exists with matching phone, link them!
  UPDATE public.factories f
  SET linked_business_id = b.id
  FROM public.businesses b
  WHERE f.business_id = p_business_id
    AND f.linked_business_id IS NULL
    AND f.is_own = FALSE
    AND f.phone IS NOT NULL
    AND length(regexp_replace(f.phone, '[^0-9]', '', 'g')) >= 10
    AND (
      regexp_replace(b.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(f.phone, '[^0-9]', '', 'g')
      OR regexp_replace(f.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(b.phone, '[^0-9]', '', 'g')
    )
    AND b.id != p_business_id;
END;
$$;

-- 2. TRIGGER: WHEN ANY NEW BUSINESS REGISTERS, AUTO-LINK EXISTING FACTORY RECORDS
CREATE OR REPLACE FUNCTION public.auto_link_on_new_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.factories f
  SET linked_business_id = NEW.id
  WHERE f.linked_business_id IS NULL
    AND f.is_own = FALSE
    AND f.phone IS NOT NULL
    AND length(regexp_replace(f.phone, '[^0-9]', '', 'g')) >= 10
    AND (
      regexp_replace(NEW.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(f.phone, '[^0-9]', '', 'g')
      OR regexp_replace(f.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(NEW.phone, '[^0-9]', '', 'g')
    )
    AND f.business_id != NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_on_new_business ON public.businesses;
CREATE TRIGGER trg_auto_link_on_new_business
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_new_business();

-- 3. IMMEDIATE ONE-TIME RUN: LINK ANY EXISTING UNLINKED FACTORIES RIGHT NOW!
UPDATE public.factories f
SET linked_business_id = b.id
FROM public.businesses b
WHERE f.linked_business_id IS NULL
  AND f.is_own = FALSE
  AND f.phone IS NOT NULL
  AND length(regexp_replace(f.phone, '[^0-9]', '', 'g')) >= 10
  AND (
    regexp_replace(b.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(f.phone, '[^0-9]', '', 'g')
    OR regexp_replace(f.phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace(b.phone, '[^0-9]', '', 'g')
  )
  AND b.id != f.business_id;

-- 4. GRANTS & RELOAD SCHEMA CACHE
GRANT EXECUTE ON FUNCTION public.sync_factory_links(UUID) TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
