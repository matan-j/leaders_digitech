CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT '#6B7280',
  order_index INTEGER     NOT NULL DEFAULT 0,
  is_won      BOOLEAN     NOT NULL DEFAULT false,
  is_lost     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_pipeline_stages_select" ON public.crm_pipeline_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_pipeline_stages_write" ON public.crm_pipeline_stages
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

INSERT INTO public.crm_pipeline_stages (name, color, order_index, is_won, is_lost) VALUES
  ('יצירת קשר', '#6B7280', 0, false, false),
  ('מעוניין',   '#3B5BDB', 1, false, false),
  ('סגירה',     '#D97706', 2, false, false),
  ('זכה',       '#16A34A', 3, true,  false),
  ('הפסיד',     '#DC2626', 4, false, true);
