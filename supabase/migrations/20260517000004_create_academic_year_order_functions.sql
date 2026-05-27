-- Academic Year Orders — Phase 1, Migration 04/05
-- Defines all functions, triggers, and the RPC for atomic save.
--
-- 1. fn_ayo_touch_order       — BEFORE UPDATE on orders. Sets updated_at + updated_by.
-- 2. fn_ayo_audit_order       — AFTER INSERT/UPDATE on orders. Writes audit rows.
-- 3. fn_ayog_audit_group      — AFTER INSERT/UPDATE/DELETE on groups. Writes audit rows.
-- 4. save_academic_year_order — RPC (SECURITY INVOKER). Atomic upsert of order + groups.
--
-- All SECURITY DEFINER functions include SET search_path = public, extensions
-- to prevent search_path hijacking. The RPC is SECURITY INVOKER so RLS applies
-- to the caller (not the function owner).


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Touch trigger for academic_year_orders (sets updated_at + updated_by)
--    Groups table uses the shared public.set_updated_at() which is already defined
--    elsewhere (see 20260512000001_create_products_catalog.sql).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_ayo_touch_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayo_touch ON public.academic_year_orders;
CREATE TRIGGER trg_ayo_touch
  BEFORE UPDATE ON public.academic_year_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_ayo_touch_order();

DROP TRIGGER IF EXISTS trg_ayog_touch ON public.academic_year_order_groups;
CREATE TRIGGER trg_ayog_touch
  BEFORE UPDATE ON public.academic_year_order_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Audit trigger for academic_year_orders
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_ayo_audit_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.academic_year_order_audit (order_id, user_id, action, new_value)
    VALUES (NEW.id, auth.uid(), 'order_created', to_jsonb(NEW));
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' beyond this point
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.academic_year_order_audit (order_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id, auth.uid(), 'order_status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  IF NEW.requested_start_date IS DISTINCT FROM OLD.requested_start_date
     OR NEW.requested_end_date IS DISTINCT FROM OLD.requested_end_date THEN
    INSERT INTO public.academic_year_order_audit (order_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id, auth.uid(), 'order_dates_changed',
      jsonb_build_object('from', OLD.requested_start_date, 'to', OLD.requested_end_date),
      jsonb_build_object('from', NEW.requested_start_date, 'to', NEW.requested_end_date)
    );
  END IF;

  IF NEW.preferred_instructor_id IS DISTINCT FROM OLD.preferred_instructor_id THEN
    INSERT INTO public.academic_year_order_audit (order_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id, auth.uid(), 'order_instructor_changed',
      jsonb_build_object('preferred_instructor_id', OLD.preferred_instructor_id),
      jsonb_build_object('preferred_instructor_id', NEW.preferred_instructor_id)
    );
  END IF;

  IF NEW.city IS DISTINCT FROM OLD.city OR NEW.region IS DISTINCT FROM OLD.region THEN
    INSERT INTO public.academic_year_order_audit (order_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id, auth.uid(), 'order_location_changed',
      jsonb_build_object('city', OLD.city, 'region', OLD.region),
      jsonb_build_object('city', NEW.city, 'region', NEW.region)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ayo_audit ON public.academic_year_orders;
CREATE TRIGGER trg_ayo_audit
  AFTER INSERT OR UPDATE ON public.academic_year_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_ayo_audit_order();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Audit trigger for academic_year_order_groups
-- ─────────────────────────────────────────────────────────────────────────────

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
    INSERT INTO public.academic_year_order_audit (order_id, group_id, user_id, action, old_value)
    VALUES (OLD.order_id, OLD.id, auth.uid(), 'group_removed', to_jsonb(OLD));
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

DROP TRIGGER IF EXISTS trg_ayog_audit ON public.academic_year_order_groups;
CREATE TRIGGER trg_ayog_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.academic_year_order_groups
  FOR EACH ROW EXECUTE FUNCTION public.fn_ayog_audit_group();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Atomic save RPC
--    Accepts a JSONB payload with the full order + groups in one call.
--    Reconciles groups (deletes those removed from payload, upserts the rest).
--    Runs as the caller (SECURITY INVOKER) so RLS applies normally.
--    The implicit transaction wrapping the function call guarantees that any
--    constraint violation in any step rolls back the entire operation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_academic_year_order(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_order_id         UUID;
  v_is_new           BOOLEAN;
  v_input_groups     JSONB;
  v_input_group_ids  UUID[];
  v_group            JSONB;
BEGIN
  v_order_id      := NULLIF(payload->>'id', '')::UUID;
  v_is_new        := v_order_id IS NULL;
  v_input_groups  := COALESCE(payload->'groups', '[]'::JSONB);

  IF v_is_new THEN
    INSERT INTO public.academic_year_orders (
      institution_id, academic_year, status,
      source_quote_id, source_opportunity_id,
      groups_count_planned, total_meetings_planned, hours_per_meeting,
      city, region, preferred_instructor_id,
      requested_start_date, requested_end_date,
      scheduling_status, notes,
      created_by, updated_by
    )
    VALUES (
      (payload->>'institution_id')::UUID,
      payload->>'academic_year',
      COALESCE(payload->>'status', 'draft'),
      NULLIF(payload->>'source_quote_id','')::UUID,
      NULLIF(payload->>'source_opportunity_id','')::UUID,
      NULLIF(payload->>'groups_count_planned','')::INT,
      NULLIF(payload->>'total_meetings_planned','')::INT,
      NULLIF(payload->>'hours_per_meeting','')::NUMERIC,
      NULLIF(payload->>'city',''),
      NULLIF(payload->>'region',''),
      NULLIF(payload->>'preferred_instructor_id','')::UUID,
      NULLIF(payload->>'requested_start_date','')::DATE,
      NULLIF(payload->>'requested_end_date','')::DATE,
      COALESCE(payload->>'scheduling_status', 'not_started'),
      NULLIF(payload->>'notes',''),
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO v_order_id;
  ELSE
    UPDATE public.academic_year_orders SET
      institution_id          = (payload->>'institution_id')::UUID,
      academic_year           = payload->>'academic_year',
      status                  = COALESCE(payload->>'status', status),
      source_quote_id         = NULLIF(payload->>'source_quote_id','')::UUID,
      source_opportunity_id   = NULLIF(payload->>'source_opportunity_id','')::UUID,
      groups_count_planned    = NULLIF(payload->>'groups_count_planned','')::INT,
      total_meetings_planned  = NULLIF(payload->>'total_meetings_planned','')::INT,
      hours_per_meeting       = NULLIF(payload->>'hours_per_meeting','')::NUMERIC,
      city                    = NULLIF(payload->>'city',''),
      region                  = NULLIF(payload->>'region',''),
      preferred_instructor_id = NULLIF(payload->>'preferred_instructor_id','')::UUID,
      requested_start_date    = NULLIF(payload->>'requested_start_date','')::DATE,
      requested_end_date      = NULLIF(payload->>'requested_end_date','')::DATE,
      scheduling_status       = COALESCE(payload->>'scheduling_status', scheduling_status),
      notes                   = NULLIF(payload->>'notes','')
    WHERE id = v_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'academic_year_order_not_found_or_no_permission: %', v_order_id;
    END IF;
  END IF;

  -- Collect IDs of groups in payload (those without an id are new and excluded here).
  SELECT array_agg(NULLIF(g->>'id','')::UUID)
    INTO v_input_group_ids
  FROM jsonb_array_elements(v_input_groups) g
  WHERE NULLIF(g->>'id','') IS NOT NULL;

  -- Delete groups that exist in DB but no longer appear in payload.
  DELETE FROM public.academic_year_order_groups
   WHERE order_id = v_order_id
     AND id <> ALL(COALESCE(v_input_group_ids, ARRAY[]::UUID[]));

  -- Upsert each group from the payload.
  FOR v_group IN SELECT * FROM jsonb_array_elements(v_input_groups)
  LOOP
    INSERT INTO public.academic_year_order_groups (
      id, order_id, course_id, age_group, grade_label,
      groups_count, requested_days_of_week, requested_time_window,
      meetings_count, hours_per_meeting, scheduling_status, sort_order, notes
    )
    VALUES (
      COALESCE(NULLIF(v_group->>'id','')::UUID, gen_random_uuid()),
      v_order_id,
      NULLIF(v_group->>'course_id','')::UUID,
      NULLIF(v_group->>'age_group',''),
      NULLIF(v_group->>'grade_label',''),
      COALESCE((v_group->>'groups_count')::INT, 1),
      CASE
        WHEN v_group ? 'requested_days_of_week'
             AND jsonb_typeof(v_group->'requested_days_of_week') = 'array'
        THEN ARRAY(
          SELECT (jsonb_array_elements_text(v_group->'requested_days_of_week'))::INT
        )
        ELSE NULL
      END,
      CASE
        WHEN v_group ? 'requested_time_window'
             AND jsonb_typeof(v_group->'requested_time_window') = 'object'
        THEN v_group->'requested_time_window'
        ELSE NULL
      END,
      NULLIF(v_group->>'meetings_count','')::INT,
      NULLIF(v_group->>'hours_per_meeting','')::NUMERIC,
      COALESCE(NULLIF(v_group->>'scheduling_status',''), 'pending'),
      COALESCE((v_group->>'sort_order')::INT, 0),
      NULLIF(v_group->>'notes','')
    )
    ON CONFLICT (id) DO UPDATE SET
      course_id               = EXCLUDED.course_id,
      age_group               = EXCLUDED.age_group,
      grade_label             = EXCLUDED.grade_label,
      groups_count            = EXCLUDED.groups_count,
      requested_days_of_week  = EXCLUDED.requested_days_of_week,
      requested_time_window   = EXCLUDED.requested_time_window,
      meetings_count          = EXCLUDED.meetings_count,
      hours_per_meeting       = EXCLUDED.hours_per_meeting,
      scheduling_status       = EXCLUDED.scheduling_status,
      sort_order              = EXCLUDED.sort_order,
      notes                   = EXCLUDED.notes;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'is_new',   v_is_new
  );
END;
$$;

COMMENT ON FUNCTION public.save_academic_year_order(JSONB) IS
  'Atomic save of an academic_year_order and its groups. Insert if payload has no id, otherwise update. Reconciles groups by id (deletes those removed, upserts the rest). Runs as caller (RLS enforced). Returns {order_id, is_new}.';
