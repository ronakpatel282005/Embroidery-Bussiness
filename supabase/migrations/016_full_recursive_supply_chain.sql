-- ============================================================
-- Migration 016: True Recursive Textile Supply Chain & Real-Time Status Cascade
-- 1. origin_allotment_id link on public.lots (with CASCADE)
-- 2. Automatic partner handoff (Adiyogi -> Shree Krishna -> Sub-factory)
-- 3. Automatic 2-way status propagation (C -> B -> A)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/okjnkadbdbstozovakpk/sql/new
-- ============================================================

-- 1. ADD origin_allotment_id TO LOTS TABLE
ALTER TABLE public.lots 
  ADD COLUMN IF NOT EXISTS origin_allotment_id UUID REFERENCES public.lot_allotments(id) ON DELETE CASCADE;

-- If column was already created previously with different constraint, ensure FK is ON DELETE CASCADE
DO $$
BEGIN
  ALTER TABLE public.lots DROP CONSTRAINT IF EXISTS lots_origin_allotment_id_fkey;
  ALTER TABLE public.lots ADD CONSTRAINT lots_origin_allotment_id_fkey 
    FOREIGN KEY (origin_allotment_id) REFERENCES public.lot_allotments(id) ON DELETE CASCADE;
EXCEPTION
  WHEN others THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_lots_origin_allotment_id ON public.lots(origin_allotment_id);
CREATE INDEX IF NOT EXISTS idx_lots_business_id ON public.lots(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_allotments_factory_id ON public.lot_allotments(factory_id);

-- 2. PARTNER HANDOFF FUNCTION (Creates Vepari + Lot in Receiver's Account)
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
  -- If factory is NOT linked to an active registered business, do nothing
  IF v_factory.linked_business_id IS NULL THEN RETURN NULL; END IF;

  -- 3. Fetch sender business details (e.g. Adiyogi)
  SELECT * INTO v_sender FROM public.businesses WHERE id = v_allotment.business_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 4. Find or create VEPARI record in receiver's account (e.g. Shree Krishna)
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

  -- Calculate total pieces for this allotment
  SELECT COALESCE(SUM(pieces), 0) INTO v_tot_pieces
  FROM public.allotment_items
  WHERE allotment_id = v_allotment.id;

  -- 5. Find or create LOT in receiver's account matching this exact allotment
  SELECT id INTO v_lot_id
  FROM public.lots
  WHERE business_id = v_factory.linked_business_id
    AND origin_allotment_id = v_allotment.id;

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
      v_allotment.challan_number,
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
    -- If lot already exists, update details & items
    UPDATE public.lots
    SET lot_number = v_allotment.challan_number,
        date = v_allotment.allotment_date,
        due_date = v_allotment.expected_delivery_date,
        pricing_type = v_allotment.pricing_type,
        total_pieces = v_tot_pieces,
        total_amount = v_allotment.total_amount,
        origin_allotment_id = v_allotment.id,
        notes = COALESCE(v_allotment.notes, notes)
    WHERE id = v_lot_id;

    -- Clean & refresh lot_items
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
        v_item.rate,
        v_item.amount
      );
    END LOOP;
  END IF;

  RETURN v_lot_id;
END;
$$;

-- 3. TRIGGER TO AUTOMATICALLY SYNC ON ALLOTMENT CREATION OR FACTORY CHANGE
CREATE OR REPLACE FUNCTION public.trig_auto_sync_allotment_handoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF pg_trigger_depth() > 10 THEN
    RETURN NEW;
  END IF;

  PERFORM public.sync_partner_allotment_to_jobwork(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_allotment_handoff ON public.lot_allotments;
CREATE TRIGGER tr_sync_allotment_handoff
  AFTER INSERT OR UPDATE OF factory_id, total_amount, challan_number, allotment_date, expected_delivery_date
  ON public.lot_allotments
  FOR EACH ROW
  EXECUTE FUNCTION public.trig_auto_sync_allotment_handoff();

-- 4. REAL-TIME RECURSIVE STATUS CASCADE (C -> B -> A)
CREATE OR REPLACE FUNCTION public.propagate_lot_status_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_all_completed BOOLEAN;
BEGIN
  -- Prevent infinite recursion
  IF pg_trigger_depth() > 10 THEN
    RETURN NEW;
  END IF;

  -- CASE A: Triggered by LOT status change
  IF TG_TABLE_NAME = 'lots' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- 1. If this lot was allotted to us by an upstream business, update that parent allotment
      IF NEW.origin_allotment_id IS NOT NULL THEN
        UPDATE public.lot_allotments
        SET status = NEW.status,
            updated_at = NOW()
        WHERE id = NEW.origin_allotment_id
          AND status IS DISTINCT FROM NEW.status;
      END IF;

      -- 2. If this lot was marked completed, mark all its child outward allotments completed too
      IF NEW.status = 'completed' THEN
        UPDATE public.lot_allotments
        SET status = 'completed',
            updated_at = NOW()
        WHERE lot_id = NEW.id
          AND status != 'completed';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- CASE B: Triggered by ALLOTMENT status change
  IF TG_TABLE_NAME = 'lot_allotments' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- 1. Update downstream mirrored lot in receiver's account (if exists)
      UPDATE public.lots
      SET status = NEW.status,
          updated_at = NOW()
      WHERE origin_allotment_id = NEW.id
        AND status IS DISTINCT FROM NEW.status;

      -- 2. If this allotment is marked 'completed', check if ALL allotments under this parent lot are done
      IF NEW.status = 'completed' THEN
        SELECT NOT EXISTS (
          SELECT 1 FROM public.lot_allotments
          WHERE lot_id = NEW.lot_id
            AND status != 'completed'
        ) INTO v_all_completed;

        IF v_all_completed THEN
          UPDATE public.lots
          SET status = 'completed',
              updated_at = NOW()
          WHERE id = NEW.lot_id
            AND status != 'completed';
        END IF;
      ELSIF NEW.status IN ('sent', 'in_progress') THEN
        -- If an allotment was reopened, re-open the parent lot if it was marked completed
        UPDATE public.lots
        SET status = 'in_progress',
            updated_at = NOW()
        WHERE id = NEW.lot_id
          AND status = 'completed';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_propagate_lot_status ON public.lots;
CREATE TRIGGER tr_propagate_lot_status
  AFTER UPDATE OF status ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_lot_status_cascade();

DROP TRIGGER IF EXISTS tr_propagate_allotment_status ON public.lot_allotments;
CREATE TRIGGER tr_propagate_allotment_status
  AFTER UPDATE OF status ON public.lot_allotments
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_lot_status_cascade();

-- 5. RETROACTIVELY MIGRATE AND SYNC ALL EXISTING ALLOTMENTS NOW
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

-- 6. GRANT EXECUTE PRIVILEGES
GRANT EXECUTE ON FUNCTION public.sync_partner_allotment_to_jobwork(UUID) TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
