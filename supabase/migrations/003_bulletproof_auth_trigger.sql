-- ============================================================
-- 003_bulletproof_auth_trigger.sql
-- Run this in your Supabase SQL Editor
-- This automatically creates the business workspace & factory
-- directly in the database when a user registers, avoiding any RLS conflicts.
-- ============================================================

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.businesses (
    user_id,
    name,
    owner_name,
    phone,
    email
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
    COALESCE(NEW.raw_user_meta_data->>'owner_name', 'Owner'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
