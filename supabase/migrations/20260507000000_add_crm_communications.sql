-- =============================================================
-- CRM: durable communication history
-- Date: 2026-05-07
-- Additive only. Keeps crm_activities as the high-level activity log.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.crm_activities(id) ON DELETE SET NULL,

  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  subject TEXT,
  body_text TEXT NOT NULL,
  body_html TEXT,

  sender_name TEXT,
  sender_address TEXT,
  recipient_name TEXT,
  recipient_address TEXT,

  provider TEXT CHECK (provider IN ('green_api', 'brevo', 'manual', 'import')),
  provider_message_id TEXT,
  provider_thread_id TEXT,
  provider_status TEXT,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  broadcast_id UUID REFERENCES public.crm_broadcasts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
  automation_rule_id UUID REFERENCES public.crm_automation_rules(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received', 'skipped')),

  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_communications_institution_time
  ON public.crm_communications(institution_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_communications_contact_time
  ON public.crm_communications(contact_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_communications_channel
  ON public.crm_communications(channel);

CREATE INDEX IF NOT EXISTS idx_crm_communications_direction
  ON public.crm_communications(direction);

CREATE INDEX IF NOT EXISTS idx_crm_communications_status
  ON public.crm_communications(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_communications_provider_message
  ON public.crm_communications(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.crm_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_communications_select_policy" ON public.crm_communications;
CREATE POLICY "crm_communications_select_policy"
  ON public.crm_communications FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_communications.institution_id
        AND (ei.crm_owner_id = auth.uid() OR ei.crm_assigned_instructor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "crm_communications_insert_policy" ON public.crm_communications;
CREATE POLICY "crm_communications_insert_policy"
  ON public.crm_communications FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "crm_communications_update_policy" ON public.crm_communications;
CREATE POLICY "crm_communications_update_policy"
  ON public.crm_communications FOR UPDATE TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "crm_communications_delete_policy" ON public.crm_communications;
CREATE POLICY "crm_communications_delete_policy"
  ON public.crm_communications FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');
