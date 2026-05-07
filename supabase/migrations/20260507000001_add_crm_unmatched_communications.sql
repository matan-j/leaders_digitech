-- =============================================================
-- CRM: unmatched inbound communication capture
-- Date: 2026-05-07
-- Additive only. Stores inbound provider messages that cannot yet be
-- linked to an institution/contact, so replies are not silently lost.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.crm_unmatched_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  body_text TEXT NOT NULL,
  sender_name TEXT,
  sender_address TEXT,
  recipient_name TEXT,
  recipient_address TEXT,
  provider TEXT CHECK (provider IN ('green_api', 'brevo', 'manual', 'import')),
  provider_message_id TEXT,
  provider_status TEXT,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (status IN ('unmatched', 'linked', 'ignored')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_unmatched_communications_time
  ON public.crm_unmatched_communications(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_unmatched_communications_sender
  ON public.crm_unmatched_communications(sender_address);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_unmatched_communications_provider_message
  ON public.crm_unmatched_communications(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.crm_unmatched_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_unmatched_communications_select_policy" ON public.crm_unmatched_communications;
CREATE POLICY "crm_unmatched_communications_select_policy"
  ON public.crm_unmatched_communications FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep', 'pedagogical_manager'));

DROP POLICY IF EXISTS "crm_unmatched_communications_insert_policy" ON public.crm_unmatched_communications;
CREATE POLICY "crm_unmatched_communications_insert_policy"
  ON public.crm_unmatched_communications FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "crm_unmatched_communications_update_policy" ON public.crm_unmatched_communications;
CREATE POLICY "crm_unmatched_communications_update_policy"
  ON public.crm_unmatched_communications FOR UPDATE TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
