-- Phase Modularity Level 1A (V6) — Safe Config Extraction
--
-- Creates the platform_audit_log table for tracking sensitive actions
-- (role changes, admin operations, etc.). This is the foundation for the
-- audit trail that will eventually be required for SaaS compliance.
--
-- NOTE (V6 scope): This migration is FILE-ONLY and MUST NOT be run in
-- production yet. See supabase/migrations/PENDING_APPROVAL.md.
--
-- No call sites use log_platform_action() yet. Adoption is deferred.

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_user_time
  ON public.platform_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_table
  ON public.platform_audit_log (target_table, created_at DESC);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_audit_log_admin_select" ON public.platform_audit_log;
CREATE POLICY "platform_audit_log_admin_select"
  ON public.platform_audit_log
  FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- No INSERT/UPDATE/DELETE policies — writes go through the SECURITY DEFINER
-- function below so that callers cannot bypass field validation.

CREATE OR REPLACE FUNCTION public.log_platform_action(
  p_action_type TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.platform_audit_log (
    user_id,
    action_type,
    target_table,
    target_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_table,
    p_target_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_platform_action(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_platform_action(TEXT, TEXT, UUID, JSONB) TO authenticated;

COMMENT ON TABLE public.platform_audit_log IS
  'Append-only audit trail for sensitive platform actions. Writes go through log_platform_action() (SECURITY DEFINER). Reads restricted to admin role.';
