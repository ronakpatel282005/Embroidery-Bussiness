-- ============================================================
-- Enable Logo Uploads in Supabase Storage (business-assets bucket)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop old policies if any exist
DROP POLICY IF EXISTS "Allow authenticated uploads to business-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to business-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from business-assets" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_read" ON storage.objects;

-- 1. Allow logged-in users to upload their logo
CREATE POLICY "Allow authenticated uploads to business-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-assets');

-- 2. Allow logged-in users to update/replace their logo
CREATE POLICY "Allow authenticated updates to business-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'business-assets');

-- 3. Allow everyone (public) to view the logos
CREATE POLICY "Allow public reads from business-assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'business-assets');
