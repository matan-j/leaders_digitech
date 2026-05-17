-- Academic Year Orders — Phase 1, Migration 06 (fix)
-- Bug: when an academic_year_order is deleted, the CASCADE removes child groups,
-- which fires fn_ayog_audit_group. That trigger tries to INSERT a 'group_removed'
-- audit row referencing the order — but the FK academic_year_order_audit.order_id
-- → academic_year_orders.id rejects the insert because the parent order is being
-- deleted in the same statement.
--
-- Fix: in the DELETE branch of fn_ayog_audit_group, skip the audit insert when the
-- parent order no longer exists (cascade scenario). Direct group deletions still
-- log normally because the parent order is still present.
--
-- Why not defer the FK or drop CASCADE: deferring leaves orphan audit rows mid-tx,
-- and dropping CASCADE means audit history would not be cleaned up with the order.
-- Skipping the audit on cascade is the cleanest semantic — the order's own
-- order_created/order_status_changed trail is sufficient context.

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
    -- Skip audit when the parent order is being deleted (cascade). The order's
    -- own audit trail captures the deletion context.
    IF EXISTS (SELECT 1 FROM public.academic_year_orders WHERE id = OLD.order_id) THEN
      INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value)
      VALUES (OLD.order_id, OLD.id, auth.uid(), 'group_removed', to_jsonb(OLD));
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
