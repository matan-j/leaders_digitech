-- Phase 8 — Academic Year Orders: scheduling link table.
--
-- The "groups" inside an order are PLANNING placeholders (how many cohorts of
-- which age, when, for how many meetings). When the operations team is ready
-- to schedule, each group materializes into one or more concrete
-- course_instances (Course × Institution × Instructor × dates × times).
--
-- This table is the N:M bridge between the two layers:
--   academic_year_order_groups  <—— link ——>  course_instances
--
-- A single group may scale to several course_instances (e.g. groups_count = 3
-- means three parallel cohorts), and a single course_instance can technically
-- satisfy more than one group (rare but possible — e.g. a cross-grade cohort).

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.academic_year_order_group_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL
    REFERENCES public.academic_year_order_groups(id) ON DELETE CASCADE,
  course_instance_id UUID NOT NULL
    REFERENCES public.course_instances(id) ON DELETE CASCADE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_ayogi_pair UNIQUE (group_id, course_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_ayogi_group
  ON public.academic_year_order_group_instances(group_id);

CREATE INDEX IF NOT EXISTS idx_ayogi_course_instance
  ON public.academic_year_order_group_instances(course_instance_id);

COMMENT ON TABLE public.academic_year_order_group_instances IS
  'Bridge between planning-layer order groups and operational course_instances. Phase 8.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Same access model as the rest of the module: admin + pedagogical_manager only.

ALTER TABLE public.academic_year_order_group_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ayogi_select ON public.academic_year_order_group_instances;
CREATE POLICY ayogi_select ON public.academic_year_order_group_instances
  FOR SELECT
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayogi_insert ON public.academic_year_order_group_instances;
CREATE POLICY ayogi_insert ON public.academic_year_order_group_instances
  FOR INSERT
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayogi_update ON public.academic_year_order_group_instances;
CREATE POLICY ayogi_update ON public.academic_year_order_group_instances
  FOR UPDATE
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

DROP POLICY IF EXISTS ayogi_delete ON public.academic_year_order_group_instances;
CREATE POLICY ayogi_delete ON public.academic_year_order_group_instances
  FOR DELETE
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

-- ─── Extend audit action vocabulary ──────────────────────────────────────────
-- Add 'group_instance_linked' and 'group_instance_unlinked' so triggers can
-- log scheduling activity. The check constraint must be dropped and recreated.

ALTER TABLE public.academic_year_order_audit
  DROP CONSTRAINT IF EXISTS academic_year_order_audit_action_check;

ALTER TABLE public.academic_year_order_audit
  ADD CONSTRAINT academic_year_order_audit_action_check CHECK (action IN (
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
    'group_scheduling_status_changed',
    'group_instance_linked',
    'group_instance_unlinked'
  ));

-- ─── Audit trigger ───────────────────────────────────────────────────────────
-- On link/unlink, write an audit row tied to the parent order so the
-- history tab shows scheduling activity alongside content changes.
-- Also auto-bump the group's scheduling_status to 'scheduled' on first link.

CREATE OR REPLACE FUNCTION public.fn_ayogi_audit_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order_id UUID;
  v_remaining INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT order_id INTO v_order_id
      FROM public.academic_year_order_groups
      WHERE id = NEW.group_id;

    INSERT INTO public.academic_year_order_audit
      (order_id, group_id, user_id, action, new_value)
    VALUES
      (v_order_id, NEW.group_id, auth.uid(), 'group_instance_linked',
       jsonb_build_object('course_instance_id', NEW.course_instance_id));

    -- Auto-flip the group's scheduling_status from 'pending' to 'scheduled'
    -- when it has at least one linked instance.
    UPDATE public.academic_year_order_groups
       SET scheduling_status = 'scheduled'
     WHERE id = NEW.group_id
       AND scheduling_status = 'pending';

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT order_id INTO v_order_id
      FROM public.academic_year_order_groups
      WHERE id = OLD.group_id;

    -- v_order_id may be NULL if the parent group was already cascade-deleted.
    -- In that case the order is gone too; skip audit to avoid FK errors.
    IF v_order_id IS NOT NULL THEN
      INSERT INTO public.academic_year_order_audit
        (order_id, group_id, user_id, action, old_value)
      VALUES
        (v_order_id, OLD.group_id, auth.uid(), 'group_instance_unlinked',
         jsonb_build_object('course_instance_id', OLD.course_instance_id));

      -- If this was the last instance for the group, revert status to pending.
      SELECT COUNT(*) INTO v_remaining
        FROM public.academic_year_order_group_instances
        WHERE group_id = OLD.group_id;

      IF v_remaining = 0 THEN
        UPDATE public.academic_year_order_groups
           SET scheduling_status = 'pending'
         WHERE id = OLD.group_id
           AND scheduling_status = 'scheduled';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayogi_audit_link
  ON public.academic_year_order_group_instances;

CREATE TRIGGER trg_ayogi_audit_link
  AFTER INSERT OR DELETE ON public.academic_year_order_group_instances
  FOR EACH ROW EXECUTE FUNCTION public.fn_ayogi_audit_link();

-- ─── created_by default via trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_ayogi_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayogi_set_created_by
  ON public.academic_year_order_group_instances;

CREATE TRIGGER trg_ayogi_set_created_by
  BEFORE INSERT ON public.academic_year_order_group_instances
  FOR EACH ROW EXECUTE FUNCTION public.fn_ayogi_set_created_by();
