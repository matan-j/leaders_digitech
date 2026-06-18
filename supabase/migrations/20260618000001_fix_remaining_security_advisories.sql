-- Fix remaining Supabase security advisor errors
-- 1. Drop old user_metadata-referencing policies (replaced by get_current_user_role() ones)
-- 2. Fix crm_contact_statuses policies to remove user_metadata references
-- 3. Enable RLS on user_roles and blocked_dates
-- 4. Recreate profiles_public view without SECURITY DEFINER

-- ─────────────────────────────────────────────────────────────────
-- Drop stale dashboard policies that reference user_metadata
-- (The correct replacements were created in 20260618000000)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and managers can select all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Admins and managers can select all lesson_reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "instructors_can_create_lesson_instances"           ON public.reported_lesson_instances;

-- ─────────────────────────────────────────────────────────────────
-- crm_contact_statuses: remove user_metadata references
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crm_contact_statuses_select_policy" ON public.crm_contact_statuses;
CREATE POLICY "crm_contact_statuses_select_policy"
  ON public.crm_contact_statuses FOR SELECT TO authenticated
  USING (
    is_active
    OR public.get_current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "crm_contact_statuses_insert_policy" ON public.crm_contact_statuses;
CREATE POLICY "crm_contact_statuses_insert_policy"
  ON public.crm_contact_statuses FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "crm_contact_statuses_update_policy" ON public.crm_contact_statuses;
CREATE POLICY "crm_contact_statuses_update_policy"
  ON public.crm_contact_statuses FOR UPDATE TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- blocked_dates: enable RLS (re-apply in case earlier migration didn't run)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read blocked dates" ON public.blocked_dates;
DROP POLICY IF EXISTS "Allow admins to manage blocked dates"            ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates_select_policy"                     ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates_insert_policy"                     ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates_update_policy"                     ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates_delete_policy"                     ON public.blocked_dates;

CREATE POLICY "blocked_dates_select_policy"
ON public.blocked_dates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "blocked_dates_insert_policy"
ON public.blocked_dates FOR INSERT TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "blocked_dates_update_policy"
ON public.blocked_dates FOR UPDATE TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "blocked_dates_delete_policy"
ON public.blocked_dates FOR DELETE TO authenticated
USING (public.get_current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- user_roles: enable RLS (legacy table, restrict to admin)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;

CREATE POLICY "user_roles_select_policy"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

CREATE POLICY "user_roles_insert_policy"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "user_roles_update_policy"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "user_roles_delete_policy"
ON public.user_roles FOR DELETE TO authenticated
USING (public.get_current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- profiles_public view: recreate without SECURITY DEFINER
-- Default behavior (SECURITY INVOKER) respects the caller's RLS.
-- ─────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
  SELECT
    id,
    full_name,
    email,
    phone,
    role,
    birthdate,
    current_work_hours,
    hourly_rate,
    benefits,
    created_at,
    updated_at
  FROM public.profiles;
