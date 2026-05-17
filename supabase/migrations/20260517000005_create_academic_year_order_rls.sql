-- Academic Year Orders — Phase 1, Migration 05/05
-- Enables RLS on all three new tables and defines Phase 1 policies.
--
-- Phase 1 access (admin + pedagogical_manager only):
--   - admin:                full CRUD on orders + groups, read on audit
--   - pedagogical_manager:  full CRUD on orders + groups, read on audit
--   - sales_rep:            no access (role exists in schema but no active users today)
--   - instructor:           no access (will be added in a later phase if needed)
--
-- The audit table is append-only from the user's perspective: only SELECT is exposed.
-- All audit writes go through SECURITY DEFINER triggers (see migration 04).

ALTER TABLE public.academic_year_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_year_order_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_year_order_audit   ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- academic_year_orders
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ayo_select ON public.academic_year_orders;
CREATE POLICY ayo_select ON public.academic_year_orders
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayo_insert ON public.academic_year_orders;
CREATE POLICY ayo_insert ON public.academic_year_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

-- UPDATE: both USING (visibility of the existing row) and WITH CHECK (new row stays compliant)
DROP POLICY IF EXISTS ayo_update ON public.academic_year_orders;
CREATE POLICY ayo_update ON public.academic_year_orders
  FOR UPDATE TO authenticated
  USING      (public.get_current_user_role() IN ('admin', 'pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayo_delete ON public.academic_year_orders;
CREATE POLICY ayo_delete ON public.academic_year_orders
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));


-- ─────────────────────────────────────────────────────────────────────────────
-- academic_year_order_groups
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ayog_select ON public.academic_year_order_groups;
CREATE POLICY ayog_select ON public.academic_year_order_groups
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayog_insert ON public.academic_year_order_groups;
CREATE POLICY ayog_insert ON public.academic_year_order_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayog_update ON public.academic_year_order_groups;
CREATE POLICY ayog_update ON public.academic_year_order_groups
  FOR UPDATE TO authenticated
  USING      (public.get_current_user_role() IN ('admin', 'pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayog_delete ON public.academic_year_order_groups;
CREATE POLICY ayog_delete ON public.academic_year_order_groups
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));


-- ─────────────────────────────────────────────────────────────────────────────
-- academic_year_order_audit — read-only from the application
-- Writes only via SECURITY DEFINER triggers; no INSERT/UPDATE/DELETE policies.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ayo_audit_select ON public.academic_year_order_audit;
CREATE POLICY ayo_audit_select ON public.academic_year_order_audit
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));


-- ─────────────────────────────────────────────────────────────────────────────
-- RPC execution grant
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.save_academic_year_order(JSONB) TO authenticated;
