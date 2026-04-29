-- =============================================================
-- CRM: Broadcast delivery log
-- Date: 2026-04-29
-- Additive only.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.crm_broadcast_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id   UUID        REFERENCES public.crm_broadcasts(id) ON DELETE CASCADE,
  institution_id UUID        REFERENCES public.educational_institutions(id) ON DELETE SET NULL,
  contact_id     UUID        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  phone          TEXT,
  email          TEXT,
  status         TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message  TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_broadcast_log_broadcast_id   ON public.crm_broadcast_log(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_log_institution_id ON public.crm_broadcast_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_log_status         ON public.crm_broadcast_log(status);

ALTER TABLE public.crm_broadcast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_broadcast_log_select_policy"
  ON public.crm_broadcast_log FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_broadcast_log_insert_policy"
  ON public.crm_broadcast_log FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'sales_rep'));
