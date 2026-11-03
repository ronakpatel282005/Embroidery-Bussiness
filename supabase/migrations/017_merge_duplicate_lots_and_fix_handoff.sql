-- ============================================================
-- Migration 017: Merge Duplicate Lots & Full Lot Allotment Sync
-- 1. Merges duplicate lots in each business so CH-740 is exactly ONE lot
-- 2. Ensures sync_partner_allotment_to_jobwork never creates duplicate lots
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. CLEANUP / MERGE DUPLICATE LOTS ACROSS ALL BUSINESSES
DO $$
DECLARE
  dup RECORD;
  v_primary_id UUID;
  v_dup_id UUID;
BEGIN
  -- Find duplicate lots having the same business_id and lot_number
  FOR dup IN (
    SELECT business_id, UPPER(TRIM(lot_number)) AS lot_num, MIN(created_at) AS first_created, COUNT(*) AS cnt
    FROM public.lots
    GROUP BY business_id, UPPER(TRIM(lot_number))
    HAVING COUNT(*) > 1
  ) LOOP
    -- Select primary lot (the first one created or the one with the most items)
    SELECT id INTO v_primary_id
    FROM public.lots
    WHERE business_id = dup.business_id
      AND UPPER(TRIM(lot_number)) = dup.lot_num
    ORDER BY total_amount DESC, created_at ASC
    LIMIT 1;

    -- For every other duplicate lot of this number
    FOR v_dup_id IN (
      SELECT id
      FROM public.lots
      WHERE business_id = dup.business_id
        AND UPPER(TRIM(lot_number)) = dup.lot_num
        AND id != v_primary_id
    ) LOOP
      -- Re-point any outward allotments pointing to the duplicate lot
      UPDATE public.lot_allotments
      SET lot_id = v_primary_id
      WHERE lot_id = v_dup_id;

      -- Delete items belonging to duplicate
      DELETE FROM public.lot_items WHERE lot_id = v_dup_id;

      -- Delete the duplicate lot row
      DELETE FROM public.lots WHERE id = v_dup_id;
    END LOOP;
  END LOOP;
END;
$$;

-- 2. BULLETPROOF SYNC FUNCTION: ALWAYS MERGES INTO EXACTLY ONE LOT
CREATE OR REPLACE FUNCTION public.sync_partner_allotment_to_jobwork(p_allotment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_allotment RECORD;
  v_parent_lot RECORD;
  v_factory RECORD;
  v_sender RECORD;
  v_vepari_id UUID;
  v_lot_id UUID;
  v_item RECORD;
  v_tot_pieces INTEGER;
  v_tot_amount NUMERIC(12,2);
  v_target_lot_num TEXT;
BEGIN
  -- 1. Fetch allotment details
  SELECT * INTO v_allotment FROM public.lot_allotments WHERE id = p_allotment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 2. Fetch parent lot of this allotment
  SELECT * INTO v_parent_lot FROM public.lots WHERE id = v_allotment.lot_id;

  -- 3. Fetch factory details
  SELECT * INTO v_factory FROM public.factories WHERE id = v_allotment.factory_id;
  -- If factory is NOT linked to an active registered business, do nothing
  IF v_factory.linked_business_id IS NULL THEN RETURN NULL; END IF;

  -- 4. Fetch sender business details (e.g. Adiyogi)
  SELECT * INTO v_sender FROM public.businesses WHERE id = v_allotment.business_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 5. Find or create VEPARI record in receiver's account (e.g. Shree Krishna)
  SELECT id INTO v_vepari_id
  FROM public.veparis
  WHERE business_id = v_factory.linked_business_id
    AND (
      linked_business_id = v_sender.id
      OR (public.clean_phone_10(phone) IS NOT NULL AND public.clean_phone_10(phone) = public.clean_phone_10(v_sender.phone))
      OR name ILIKE v_sender.name
    )
  LIMIT 1;

  IF v_vepari_id IS NULL THEN
    INSERT INTO public.veparis (
      business_id,
      name,
      phone,
      address,
      linked_business_id
    ) VALUES (
      v_factory.linked_business_id,
      v_sender.name,
      v_sender.phone,
      v_sender.address,
      v_sender.id
    ) RETURNING id INTO v_vepari_id;
  ELSE
    UPDATE public.veparis
    SET linked_business_id = v_sender.id,
        phone = COALESCE(phone, v_sender.phone),
        address = COALESCE(address, v_sender.address)
    WHERE id = v_vepari_id;
  END IF;

  v_target_lot_num := COALESCE(v_allotment.challan_number, v_parent_lot.lot_number, 'CH-Job');

  -- 6. Sum all pieces and amount for all allotments of this challan sent to this factory
  SELECT 
    COALESCE(SUM(la.total_amount), v_allotment.total_amount),
    COALESCE(SUM(ai.pieces), 0)
  INTO v_tot_amount, v_tot_pieces
  FROM public.lot_allotments la
  LEFT JOIN public.allotment_items ai ON ai.allotment_id = la.id
  WHERE la.business_id = v_allotment.business_id
    AND la.factory_id = v_allotment.factory_id
    AND (la.challan_number = v_allotment.challan_number OR la.lot_id = v_allotment.lot_id);

  IF v_tot_pieces = 0 THEN
    SELECT COALESCE(SUM(pieces), 0) INTO v_tot_pieces
    FROM public.allotment_items
    WHERE allotment_id = v_allotment.id;
  END IF;

  -- 7. Find existing LOT in receiver's account matching this exact lot/challan
  SELECT id INTO v_lot_id
  FROM public.lots
  WHERE business_id = v_factory.linked_business_id
    AND vepari_id = v_vepari_id
    AND (
      origin_allotment_id = v_allotment.id
      OR UPPER(TRIM(lot_number)) = UPPER(TRIM(v_target_lot_num))
      OR (v_parent_lot.lot_number IS NOT NULL AND UPPER(TRIM(lot_number)) = UPPER(TRIM(v_parent_lot.lot_number)))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_lot_id IS NULL THEN
    INSERT INTO public.lots (
      business_id,
      vepari_id,
      lot_number,
      date,
      due_date,
      pricing_type,
      total_pieces,
      total_amount,
      status,
      notes,
      origin_allotment_id
    ) VALUES (
      v_factory.linked_business_id,
      v_vepari_id,
      v_target_lot_num,
      v_allotment.allotment_date,
      v_allotment.expected_delivery_date,
      v_allotment.pricing_type,
      v_tot_pieces,
      v_allotment.total_amount,
      CASE 
        WHEN v_allotment.status = 'completed' THEN 'completed'
        ELSE 'received'
      END,
      COALESCE(v_allotment.notes, 'Job work received from ' || v_sender.name),
      v_allotment.id
    ) RETURNING id INTO v_lot_id;
  ELSE
    UPDATE public.lots
    SET lot_number = v_target_lot_num,
        date = v_allotment.allotment_date,
        due_date = v_allotment.expected_delivery_date,
        pricing_type = v_allotment.pricing_type,
        total_pieces = v_tot_pieces,
        total_amount = v_allotment.total_amount,
        origin_allotment_id = v_allotment.id,
        notes = COALESCE(v_allotment.notes, notes)
    WHERE id = v_lot_id;
  END IF;

  -- Refresh lot_items for receiver: copy all garment parts from parent lot or allotment
  DELETE FROM public.lot_items WHERE lot_id = v_lot_id;

  IF v_parent_lot.id IS NOT NULL THEN
    -- Copy original garment parts breakdown from parent lot
    FOR v_item IN (SELECT * FROM public.lot_items WHERE lot_id = v_parent_lot.id) LOOP
      INSERT INTO public.lot_items (
        business_id,
        lot_id,
        work_type_name,
        pieces,
        rate,
        amount
      ) VALUES (
        v_factory.linked_business_id,
        v_lot_id,
        v_item.work_type_name,
        v_item.pieces,
        v_allotment.rate_per_piece,
        v_item.pieces * v_allotment.rate_per_piece
      );
    END LOOP;
  ELSE
    FOR v_item IN (SELECT * FROM public.allotment_items WHERE allotment_id = v_allotment.id) LOOP
      INSERT INTO public.lot_items (
        business_id,
        lot_id,
        work_type_name,
        pieces,
        rate,
        amount
      ) VALUES (
        v_factory.linked_business_id,
        v_lot_id,
        v_item.work_type_name,
        v_item.pieces,
        v_item.rate,
        v_item.amount
      );
    END LOOP;
  END IF;

  RETURN v_lot_id;
END;
$$;

-- 3. RETROACTIVELY RE-SYNC TO ENSURE CLEAN 1-TO-1 MAPPING
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT ON (la.factory_id, la.challan_number) la.id
    FROM public.lot_allotments la
    JOIN public.factories f ON f.id = la.factory_id
    WHERE f.linked_business_id IS NOT NULL
    ORDER BY la.factory_id, la.challan_number, la.created_at ASC
  ) LOOP
    PERFORM public.sync_partner_allotment_to_jobwork(r.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
