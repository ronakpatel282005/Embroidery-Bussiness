-- ============================================================
-- Module 5 & 6: True Textile Supply Chain Handoff
-- When Adiyogi allots work to Shree Krishna:
-- 1. Creates/ensures Adiyogi Designers is a VEPARI in Shree Krishna's account
-- 2. Creates an actual LOT (CH-740) in Shree Krishna's account
-- 3. Creates the LOT_ITEMS (dupatta, plazo, bottom) in Shree Krishna's account
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_partner_allotment_to_jobwork(p_allotment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_allotment RECORD;
  v_factory RECORD;
  v_sender RECORD;
  v_vepari_id UUID;
  v_lot_id UUID;
  v_item RECORD;
  v_tot_pieces INTEGER;
BEGIN
  -- 1. Fetch allotment details
  SELECT * INTO v_allotment FROM public.lot_allotments WHERE id = p_allotment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 2. Fetch factory details
  SELECT * INTO v_factory FROM public.factories WHERE id = v_allotment.factory_id;
  -- If factory is NOT linked to an active platform user, nothing to mirror!
  IF v_factory.linked_business_id IS NULL THEN RETURN NULL; END IF;

  -- 3. Fetch sender business details (Adiyogi)
  SELECT * INTO v_sender FROM public.businesses WHERE id = v_allotment.business_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 4. Find or create VEPARI record in receiver's account (Shree Krishna)
  SELECT id INTO v_vepari_id
  FROM public.veparis
  WHERE business_id = v_factory.linked_business_id
    AND (
      linked_business_id = v_sender.id
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
    SET linked_business_id = v_sender.id
    WHERE id = v_vepari_id AND linked_business_id IS NULL;
  END IF;

  -- Calculate total pieces for this allotment
  SELECT COALESCE(SUM(pieces), 0) INTO v_tot_pieces
  FROM public.allotment_items
  WHERE allotment_id = v_allotment.id;

  -- 5. Find or create LOT in receiver's account (Shree Krishna)
  SELECT id INTO v_lot_id
  FROM public.lots
  WHERE business_id = v_factory.linked_business_id
    AND vepari_id = v_vepari_id
    AND lot_number = v_allotment.challan_number;

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
      notes
    ) VALUES (
      v_factory.linked_business_id,
      v_vepari_id,
      v_allotment.challan_number,
      v_allotment.allotment_date,
      v_allotment.expected_delivery_date,
      v_allotment.pricing_type,
      v_tot_pieces,
      v_allotment.total_amount,
      'received',
      COALESCE(v_allotment.notes, 'Job work received from ' || v_sender.name)
    ) RETURNING id INTO v_lot_id;

    -- Copy items into lot_items for receiver
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
  ELSE
    -- If lot already exists for this challan (e.g. multiple items), append items and update totals
    UPDATE public.lots
    SET total_amount = total_amount + v_allotment.total_amount,
        total_pieces = total_pieces + v_tot_pieces
    WHERE id = v_lot_id;

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

-- 2. Retroactively Sync All Existing Allotments Right Now (including CH-740!)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT la.id 
    FROM public.lot_allotments la
    JOIN public.factories f ON f.id = la.factory_id
    WHERE f.linked_business_id IS NOT NULL
  ) LOOP
    PERFORM public.sync_partner_allotment_to_jobwork(r.id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_partner_allotment_to_jobwork(UUID) TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
