-- ============================================================
-- Fix search_path & use native gen_random_uuid()
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure tables use native gen_random_uuid() which doesn't depend on schema paths
ALTER TABLE public.businesses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.factories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.work_types ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.expense_categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.payment_modes ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Update seed_default_master_data with explicit search_path
CREATE OR REPLACE FUNCTION public.seed_default_master_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Auto-create "My Own Factory"
  INSERT INTO public.factories (business_id, name, is_own)
  VALUES (NEW.id, 'My Own Factory', TRUE);

  -- Default work types
  INSERT INTO public.work_types (business_id, name) VALUES
    (NEW.id, 'Top'),
    (NEW.id, 'Sleeve'),
    (NEW.id, 'Bottom'),
    (NEW.id, 'Plazo'),
    (NEW.id, 'Lace');

  -- Default expense categories
  INSERT INTO public.expense_categories (business_id, name) VALUES
    (NEW.id, 'Rent'),
    (NEW.id, 'Electricity'),
    (NEW.id, 'Salary'),
    (NEW.id, 'Transport'),
    (NEW.id, 'Other');

  -- Default payment modes
  INSERT INTO public.payment_modes (business_id, name) VALUES
    (NEW.id, 'Cash'),
    (NEW.id, 'Bank Transfer'),
    (NEW.id, 'UPI'),
    (NEW.id, 'Cheque');

  RETURN NEW;
END;
$$;

-- 3. Update handle_new_user with explicit search_path and safe values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.businesses (
    user_id,
    name,
    owner_name,
    phone,
    email
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), 'My Business'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'owner_name', ''), 'Owner'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '0000000000'),
    COALESCE(NEW.email, '')
  );

  RETURN NEW;
END;
$$;
