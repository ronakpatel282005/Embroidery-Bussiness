-- ============================================================
-- Fix RLS policies to explicitly allow INSERT with WITH CHECK
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "businesses_own" ON businesses;
DROP POLICY IF EXISTS "factories_own" ON factories;
DROP POLICY IF EXISTS "work_types_own" ON work_types;
DROP POLICY IF EXISTS "expense_categories_own" ON expense_categories;
DROP POLICY IF EXISTS "payment_modes_own" ON payment_modes;

-- Recreate with explicit WITH CHECK for inserts
CREATE POLICY "businesses_own" ON businesses
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "factories_own" ON factories
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE POLICY "work_types_own" ON work_types
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE POLICY "expense_categories_own" ON expense_categories
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE POLICY "payment_modes_own" ON payment_modes
  FOR ALL
  USING (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());
