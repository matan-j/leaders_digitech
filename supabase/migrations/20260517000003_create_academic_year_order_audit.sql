-- Academic Year Orders — Phase 1, Migration 03/05
-- Creates the academic_year_order_audit table only.
-- This table is append-only from the application's perspective. All writes happen
-- through SECURITY DEFINER triggers defined in migration 04. RLS in migration 05
-- exposes SELECT only — there are no INSERT/UPDATE/DELETE policies for users.

CREATE TABLE IF NOT EXISTS public.academic_year_order_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id     UUID NOT NULL
                 REFERENCES public.academic_year_orders(id) ON DELETE CASCADE,

  group_id     UUID
                 REFERENCES public.academic_year_order_groups(id) ON DELETE SET NULL,

  user_id      UUID REFERENCES auth.users(id),

  action       TEXT NOT NULL
                 CHECK (action IN (
                   'order_created',
                   'order_status_changed',
                   'order_dates_changed',
                   'order_instructor_changed',
                   'order_location_changed',
                   'group_added',
                   'group_removed',
                   'group_days_changed',
                   'group_time_changed',
                   'group_count_changed',
                   'group_scheduling_status_changed'
                 )),

  old_value    JSONB,
  new_value    JSONB,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ayo_audit_order
  ON public.academic_year_order_audit(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ayo_audit_user
  ON public.academic_year_order_audit(user_id);

CREATE INDEX IF NOT EXISTS idx_ayo_audit_action
  ON public.academic_year_order_audit(action);

COMMENT ON TABLE public.academic_year_order_audit IS
  'Append-only audit trail for academic_year_orders and academic_year_order_groups. Written exclusively by SECURITY DEFINER triggers (see migration 04). No direct user writes (see RLS in migration 05).';
