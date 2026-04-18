CREATE TABLE IF NOT EXISTS public.crm_automation_rules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type   TEXT        NOT NULL CHECK (trigger_type IN ('stage_enter', 'no_contact', 'deal_won')),
  trigger_value  TEXT,
  channel        TEXT        NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  template_id    UUID        REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
  delay_minutes  INTEGER     NOT NULL DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_automation_rules_select" ON public.crm_automation_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_automation_rules_write" ON public.crm_automation_rules
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));
