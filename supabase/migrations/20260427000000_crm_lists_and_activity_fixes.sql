-- =============================================================
-- CRM: Activity fixes, last_contact trigger, tags, lists
-- Date: 2026-04-27
-- Additive only. No existing columns dropped.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. crm_activities — make user_id nullable
--    Required for incoming webhook inserts where no user exists.
--    SERVICE_ROLE_KEY bypasses RLS so existing policies are safe.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.crm_activities
  ALTER COLUMN user_id DROP NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 2. crm_activities — add direction column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS direction TEXT
    CHECK (direction IN ('inbound', 'outbound'))
    DEFAULT 'outbound';

-- Backfill any existing rows that have no direction value
UPDATE public.crm_activities
  SET direction = 'outbound'
  WHERE direction IS NULL;


-- ─────────────────────────────────────────────────────────────
-- 3. Trigger: auto-update crm_last_contact_at on institution
--    Fires AFTER INSERT on crm_activities.
--    Only advances the timestamp — never moves it backwards.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_last_contact_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.educational_institutions
    SET crm_last_contact_at = NEW.occurred_at
    WHERE id = NEW.institution_id
      AND (
        crm_last_contact_at IS NULL
        OR NEW.occurred_at > crm_last_contact_at
      );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_last_contact_at ON public.crm_activities;

CREATE TRIGGER trg_update_last_contact_at
  AFTER INSERT ON public.crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_last_contact_at();


-- ─────────────────────────────────────────────────────────────
-- 4. educational_institutions — add crm_tags column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.educational_institutions
  ADD COLUMN IF NOT EXISTS crm_tags TEXT[] DEFAULT '{}';


-- ─────────────────────────────────────────────────────────────
-- 5. crm_lists — named audience lists (manual or dynamic)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_lists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  type          TEXT        NOT NULL DEFAULT 'manual'
    CHECK (type IN ('dynamic', 'manual')),
  filter_config JSONB,
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lists_created_by ON public.crm_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_lists_type       ON public.crm_lists(type);


-- ─────────────────────────────────────────────────────────────
-- 6. crm_list_members — institutions belonging to a list
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_list_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id        UUID        NOT NULL REFERENCES public.crm_lists(id) ON DELETE CASCADE,
  institution_id UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (list_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_list_members_list_id        ON public.crm_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_crm_list_members_institution_id ON public.crm_list_members(institution_id);


-- ─────────────────────────────────────────────────────────────
-- 7. RLS on crm_lists and crm_list_members
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.crm_lists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_list_members ENABLE ROW LEVEL SECURITY;

-- crm_lists ───────────────────────────────────────────────────
CREATE POLICY "crm_lists_select_policy"
  ON public.crm_lists FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_lists_insert_policy"
  ON public.crm_lists FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_lists_update_policy"
  ON public.crm_lists FOR UPDATE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_lists_delete_policy"
  ON public.crm_lists FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));

-- crm_list_members ────────────────────────────────────────────
CREATE POLICY "crm_list_members_select_policy"
  ON public.crm_list_members FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_list_members_insert_policy"
  ON public.crm_list_members FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'sales_rep'));

CREATE POLICY "crm_list_members_delete_policy"
  ON public.crm_list_members FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'sales_rep'));


-- =============================================================
-- TRIGGER TEST (comment only — do not execute)
-- =============================================================
/*
DO $$
DECLARE
  v_institution_id UUID;
  v_before         TIMESTAMPTZ;
  v_after          TIMESTAMPTZ;
BEGIN
  -- Pick any institution that has crm_last_contact_at set
  SELECT id, crm_last_contact_at
    INTO v_institution_id, v_before
    FROM public.educational_institutions
    WHERE crm_last_contact_at IS NOT NULL
    LIMIT 1;

  IF v_institution_id IS NULL THEN
    RAISE NOTICE 'No institution with crm_last_contact_at — skipping test';
    RETURN;
  END IF;

  RAISE NOTICE 'Before: %', v_before;

  -- Insert a future activity — should advance crm_last_contact_at
  INSERT INTO public.crm_activities
    (institution_id, user_id, type, direction, summary, status, occurred_at)
  VALUES
    (v_institution_id, NULL, 'וואטסאפ', 'inbound', 'test message', 'Completed', NOW() + INTERVAL '1 hour');

  SELECT crm_last_contact_at INTO v_after
    FROM public.educational_institutions WHERE id = v_institution_id;

  RAISE NOTICE 'After (should be newer): %', v_after;
  ASSERT v_after > v_before, 'Trigger did not advance crm_last_contact_at';

  -- Insert a past activity — should NOT move crm_last_contact_at backwards
  INSERT INTO public.crm_activities
    (institution_id, user_id, type, direction, summary, status, occurred_at)
  VALUES
    (v_institution_id, NULL, 'שיחה', 'outbound', 'old call', 'Completed', NOW() - INTERVAL '30 days');

  DECLARE v_after2 TIMESTAMPTZ;
  SELECT crm_last_contact_at INTO v_after2
    FROM public.educational_institutions WHERE id = v_institution_id;

  RAISE NOTICE 'After past insert (should be unchanged): %', v_after2;
  ASSERT v_after2 = v_after, 'Trigger incorrectly moved crm_last_contact_at backwards';

  RAISE NOTICE 'All trigger assertions passed';
  ROLLBACK;
END $$;
*/
