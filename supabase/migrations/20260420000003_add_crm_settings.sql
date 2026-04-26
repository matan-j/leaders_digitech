CREATE TABLE IF NOT EXISTS public.crm_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        UNIQUE NOT NULL,
  value      TEXT,
  updated_by UUID        REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_settings_select" ON public.crm_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_settings_write" ON public.crm_settings
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

INSERT INTO public.crm_settings (key, value) VALUES ('instructor_commission', '0')
  ON CONFLICT (key) DO NOTHING;
