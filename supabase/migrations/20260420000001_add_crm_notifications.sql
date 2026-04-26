CREATE TABLE IF NOT EXISTS public.crm_notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id UUID        REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  body           TEXT,
  is_read        BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notifications_select" ON public.crm_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "crm_notifications_update" ON public.crm_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "crm_notifications_insert" ON public.crm_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));
