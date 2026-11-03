-- ============================================================
-- Embroidery Business Platform — Module 1 Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BUSINESSES TABLE
-- ============================================================
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  owner_name  TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT NOT NULL,
  address     TEXT,
  logo_url    TEXT,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX businesses_user_id_idx ON businesses(user_id);

-- ============================================================
-- FACTORIES TABLE
-- ============================================================
CREATE TABLE factories (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  owner_name         TEXT,
  phone              TEXT,
  is_own             BOOLEAN NOT NULL DEFAULT FALSE,
  linked_business_id UUID REFERENCES businesses(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MASTER SETTINGS TABLES
-- ============================================================
CREATE TABLE work_types (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_modes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER factories_updated_at
  BEFORE UPDATE ON factories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes      ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's business_id
CREATE OR REPLACE FUNCTION my_business_id()
RETURNS UUID AS $$
  SELECT id FROM businesses WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policies with explicit WITH CHECK for INSERTs
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

-- ============================================================
-- AUTO-SEED DEFAULT MASTER DATA & 'MY OWN FACTORY' ON BUSINESS CREATE
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_master_data()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Auto-create "My Own Factory"
  INSERT INTO factories (business_id, name, is_own)
  VALUES (NEW.id, 'My Own Factory', TRUE);

  -- 2. Default work types
  INSERT INTO work_types (business_id, name) VALUES
    (NEW.id, 'Top'),
    (NEW.id, 'Sleeve'),
    (NEW.id, 'Bottom'),
    (NEW.id, 'Plazo'),
    (NEW.id, 'Lace');

  -- 3. Default expense categories
  INSERT INTO expense_categories (business_id, name) VALUES
    (NEW.id, 'Rent'),
    (NEW.id, 'Electricity'),
    (NEW.id, 'Salary'),
    (NEW.id, 'Transport'),
    (NEW.id, 'Other');

  -- 4. Default payment modes
  INSERT INTO payment_modes (business_id, name) VALUES
    (NEW.id, 'Cash'),
    (NEW.id, 'Bank Transfer'),
    (NEW.id, 'UPI'),
    (NEW.id, 'Cheque');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER seed_master_data_on_business_create
  AFTER INSERT ON businesses
  FOR EACH ROW EXECUTE FUNCTION seed_default_master_data();
