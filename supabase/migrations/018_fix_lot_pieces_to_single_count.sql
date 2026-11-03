-- ============================================================
-- Migration 018: Fix Lot Pieces Count (240 suits, not 240+240+240=720)
-- 1. Updates sync_partner_allotment_to_jobwork to use parent lot total_pieces (240)
-- 2. Corrects existing lots where total_pieces was multiplied by number of parts
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. CORRECT EXISTING LOTS IN DATABASE
-- For incoming partner lots (Job Work), total_pieces MUST match the allotted pieces (e.g. 40 pcs, not the sender's 240 pcs!)
UPDATE public.lots l
SET total_pieces = COALESCE(
  (
    SELECT MAX(ai.pieces)
    FROM public.allotment_items ai
    WHERE ai.allotment_id = l.origin_allotment_id
  ),
  (
    SELECT MAX(li.pieces) 
    FROM public.lot_items li 
    WHERE li.lot_id = l.id
  ),
  l.total_pieces
)
WHERE l.origin_allotment_id IS NOT NULL;

-- Also fix any lot where total_pieces equals sum of parts instead of suit count
UPDATE public.lots l
SET total_pieces = sub.max_p
FROM (
  SELECT lot_id, MAX(pieces) AS max_p, COUNT(*) AS part_count, SUM(pieces) AS sum_p
  FROM public.lot_items
  GROUP BY lot_id
  HAVING COUNT(*) > 1
) sub
WHERE l.id = sub.lot_id
  AND l.total_pieces = sub.sum_p
  AND sub.max_p > 0;

-- 2. UPDATE SYNC FUNCTION TO ALWAYS PRESERVE SUIT COUNT (240)
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

  -- 6. Lot Pieces is the SUIT COUNT of this allotment (e.g. 200 pcs when split, or 240 pcs when full), NEVER 240+240+240!
  SELECT COALESCE(MAX(pieces), 0) INTO v_tot_pieces
  FROM public.allotment_items
  WHERE allotment_id = v_allotment.id;

  IF v_tot_pieces = 0 AND v_parent_lot.id IS NOT NULL THEN
    v_tot_pieces := v_parent_lot.total_pieces;
  END IF;

  v_tot_amount := v_allotment.total_amount;

  -- 7. Find existing LOT in receiver's account matching this exact allotment/challan
  SELECT id INTO v_lot_id
  FROM public.lots
  WHERE business_id = v_factory.linked_business_id
    AND vepari_id = v_vepari_id
    AND (
      origin_allotment_id = v_allotment.id
      OR UPPER(TRIM(lot_number)) = UPPER(TRIM(v_target_lot_num))
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
      v_tot_amount,
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
        total_amount = v_tot_amount,
        origin_allotment_id = v_allotment.id,
        notes = COALESCE(v_allotment.notes, notes)
    WHERE id = v_lot_id;
  END IF;

  -- Refresh lot_items for receiver: copy garment parts from allotment_items
  DELETE FROM public.lot_items WHERE lot_id = v_lot_id;

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
      COALESCE(v_item.rate, v_allotment.rate_per_piece, 0),
      COALESCE(v_item.amount, v_item.pieces * COALESCE(v_allotment.rate_per_piece, 0), 0)
    );
  END LOOP;

  -- Fallback if allotment_items was empty
  IF NOT EXISTS (SELECT 1 FROM public.lot_items WHERE lot_id = v_lot_id) AND v_parent_lot.id IS NOT NULL THEN
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
        v_tot_pieces,
        v_allotment.rate_per_piece,
        v_tot_pieces * COALESCE(v_allotment.rate_per_piece, 0)
      );
    END LOOP;
  END IF;

  RETURN v_lot_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
