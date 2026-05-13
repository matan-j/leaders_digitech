-- Editable company branding for quote PDFs.
-- Stores a JSON blob in crm_settings (admin-only write per existing policy)
-- and creates a public storage bucket for the uploaded logo.

-- 1) Seed default company_info row. Values match what's currently hardcoded
--    in src/lib/quotes/company-info.ts so first-load behavior is unchanged.
INSERT INTO public.crm_settings (key, value) VALUES (
  'company_info',
  '{"legalName":"דיגיטק השכלה פרקטית בע״מ","address":"שדרות נים 2, ראשון לציון","phone":"051-5706680","email":"office@digi-tech.co.il","taxId":"516613742","website":"","tagline":"","logoUrl":"/logoReg.png"}'::text
) ON CONFLICT (key) DO NOTHING;

-- 2) Branding storage bucket (public read, admin-only write)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('branding', 'branding', true)
  ON CONFLICT (id) DO NOTHING;

-- 3) RLS policies on storage.objects, scoped to the branding bucket.
--    SELECT is open (so the PDF can fetch the logo from any session, including anon).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'branding_public_read'
  ) THEN
    CREATE POLICY "branding_public_read" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'branding');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'branding_admin_insert'
  ) THEN
    CREATE POLICY "branding_admin_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'branding'
        AND public.get_current_user_role() = 'admin'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'branding_admin_update'
  ) THEN
    CREATE POLICY "branding_admin_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'branding'
        AND public.get_current_user_role() = 'admin'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'branding_admin_delete'
  ) THEN
    CREATE POLICY "branding_admin_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'branding'
        AND public.get_current_user_role() = 'admin'
      );
  END IF;
END $$;
