-- Academic Year Orders — Phase 1, Migration 07 (fix)
-- Bug: when a single group is DELETEd directly (not via order cascade), the
-- AFTER DELETE trigger fires fn_ayog_audit_group which inserts an audit row
-- with group_id = OLD.id. The FK academic_year_order_audit.group_id →
-- academic_year_order_groups.id is enforced at insert time and rejects the
-- row because the group is being deleted in the same statement.
--
-- Fix: in the DELETE branch, write group_id = NULL on the audit row. The
-- old_value JSONB still contains the deleted group's full state (including
-- its id), so no information is lost — only the live FK reference is dropped
-- because the row it would point to is gone.
--
-- The order_id FK still works because migration 06 already gates the audit
-- insert on "parent order exists" (handles the cascade case there).

CREATE OR REPLACE FUNCTION public.fn_ayog_audit_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, new_value)
    VALUES (NEW.order_id, NEW.id, auth.uid(), 'group_added', to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Skip audit when parent order is being cascade-deleted (migration 06).
    -- For direct group deletes, the parent still exists — log with group_id=NULL
    -- since the FK on audit.group_id would reject a reference to the row being
    -- removed. The OLD payload preserves the group's id and full state inside
    -- old_value, so the audit trail remains complete.
    IF EXISTS (SELECT 1 FROM public.academic_year_orders WHERE id = OLD.order_id) THEN
      INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value)
      VALUES (OLD.order_id, NULL, auth.uid(), 'group_removed', to_jsonb(OLD));
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE' beyond this point
  IF NEW.requested_days_of_week IS DISTINCT FROM OLD.requested_days_of_week THEN
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.order_id, NEW.id, auth.uid(), 'group_days_changed',
      jsonb_build_object('days', OLD.requested_days_of_week),
      jsonb_build_object('days', NEW.requested_days_of_week)
    );
  END IF;

  IF NEW.requested_time_window IS DISTINCT FROM OLD.requested_time_window THEN
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.order_id, NEW.id, auth.uid(), 'group_time_changed',
      OLD.requested_time_window, NEW.requested_time_window
    );
  END IF;

  IF NEW.groups_count IS DISTINCT FROM OLD.groups_count THEN
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.order_id, NEW.id, auth.uid(), 'group_count_changed',
      jsonb_build_object('count', OLD.groups_count),
      jsonb_build_object('count', NEW.groups_count)
    );
  END IF;

  IF NEW.scheduling_status IS DISTINCT FROM OLD.scheduling_status THEN
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.order_id, NEW.id, auth.uid(), 'group_scheduling_status_changed',
      jsonb_build_object('scheduling_status', OLD.scheduling_status),
      jsonb_build_object('scheduling_status', NEW.scheduling_status)
    );
  END IF;

  RETURN NEW;
END;
$$;
