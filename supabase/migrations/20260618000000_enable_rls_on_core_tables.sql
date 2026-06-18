-- Enable RLS on core tables that were created via the Supabase dashboard
-- and therefore never had RLS enabled through migrations.
-- Fixes Supabase security alert: rls_disabled_in_public

-- ─────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy"        ON public.profiles;
-- Legacy dashboard policy names
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- All authenticated users need to read profiles (instructor dropdowns, nav, etc.)
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users update their own row; admins/PMs can update any
CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- Profiles are created by the auth trigger (service role); admin can also insert
CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() = 'admin'
);

-- Only admin can delete profiles
CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() = 'admin'
);

-- ─────────────────────────────────────────────────────────────────
-- educational_institutions
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.educational_institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "educational_institutions_select_policy" ON public.educational_institutions;
DROP POLICY IF EXISTS "educational_institutions_insert_policy" ON public.educational_institutions;
DROP POLICY IF EXISTS "educational_institutions_update_policy" ON public.educational_institutions;
DROP POLICY IF EXISTS "educational_institutions_delete_policy" ON public.educational_institutions;
DROP POLICY IF EXISTS "Anyone can view institutions" ON public.educational_institutions;

CREATE POLICY "educational_institutions_select_policy"
ON public.educational_institutions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "educational_institutions_insert_policy"
ON public.educational_institutions FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "educational_institutions_update_policy"
ON public.educational_institutions FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "educational_institutions_delete_policy"
ON public.educational_institutions FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- ─────────────────────────────────────────────────────────────────
-- course_instances
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.course_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_instances_select_policy"        ON public.course_instances;
DROP POLICY IF EXISTS "course_instances_insert_policy"        ON public.course_instances;
DROP POLICY IF EXISTS "course_instances_update_policy"        ON public.course_instances;
DROP POLICY IF EXISTS "course_instances_delete_policy"        ON public.course_instances;
DROP POLICY IF EXISTS "Admins and managers can view all course instances" ON public.course_instances;
DROP POLICY IF EXISTS "Instructors can view their own course instances" ON public.course_instances;

-- Admin/PM see all; instructor sees only their own
CREATE POLICY "course_instances_select_policy"
ON public.course_instances FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
  OR instructor_id = auth.uid()
);

CREATE POLICY "course_instances_insert_policy"
ON public.course_instances FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "course_instances_update_policy"
ON public.course_instances FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "course_instances_delete_policy"
ON public.course_instances FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- ─────────────────────────────────────────────────────────────────
-- lesson_reports
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_reports_select_policy" ON public.lesson_reports;
DROP POLICY IF EXISTS "lesson_reports_insert_policy" ON public.lesson_reports;
DROP POLICY IF EXISTS "lesson_reports_update_policy" ON public.lesson_reports;
DROP POLICY IF EXISTS "lesson_reports_delete_policy" ON public.lesson_reports;
DROP POLICY IF EXISTS "Instructors can view their own lesson reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "Admins can view all lesson reports" ON public.lesson_reports;

-- Admin/PM see all; instructor sees own reports (as subject or submitter)
CREATE POLICY "lesson_reports_select_policy"
ON public.lesson_reports FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
  OR instructor_id = auth.uid()
  OR reported_by = auth.uid()
);

-- Admin/PM or the instructor submitting their own report
CREATE POLICY "lesson_reports_insert_policy"
ON public.lesson_reports FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
  OR reported_by = auth.uid()
);

CREATE POLICY "lesson_reports_update_policy"
ON public.lesson_reports FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
  OR reported_by = auth.uid()
);

CREATE POLICY "lesson_reports_delete_policy"
ON public.lesson_reports FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- ─────────────────────────────────────────────────────────────────
-- reported_lesson_instances
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.reported_lesson_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reported_lesson_instances_select_policy" ON public.reported_lesson_instances;
DROP POLICY IF EXISTS "reported_lesson_instances_insert_policy" ON public.reported_lesson_instances;
DROP POLICY IF EXISTS "reported_lesson_instances_update_policy" ON public.reported_lesson_instances;
DROP POLICY IF EXISTS "reported_lesson_instances_delete_policy" ON public.reported_lesson_instances;

-- All authenticated can read (needed for schedule/report lookups)
CREATE POLICY "reported_lesson_instances_select_policy"
ON public.reported_lesson_instances FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "reported_lesson_instances_insert_policy"
ON public.reported_lesson_instances FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
  OR EXISTS (
    SELECT 1 FROM public.lesson_reports lr
    WHERE lr.id = lesson_report_id
      AND (lr.reported_by = auth.uid() OR lr.instructor_id = auth.uid())
  )
);

CREATE POLICY "reported_lesson_instances_update_policy"
ON public.reported_lesson_instances FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "reported_lesson_instances_delete_policy"
ON public.reported_lesson_instances FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- ─────────────────────────────────────────────────────────────────
-- lesson_schedules
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_schedules_select_policy" ON public.lesson_schedules;
DROP POLICY IF EXISTS "lesson_schedules_insert_policy" ON public.lesson_schedules;
DROP POLICY IF EXISTS "lesson_schedules_update_policy" ON public.lesson_schedules;
DROP POLICY IF EXISTS "lesson_schedules_delete_policy" ON public.lesson_schedules;
DROP POLICY IF EXISTS "Anyone can view lesson schedules" ON public.lesson_schedules;

CREATE POLICY "lesson_schedules_select_policy"
ON public.lesson_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "lesson_schedules_insert_policy"
ON public.lesson_schedules FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "lesson_schedules_update_policy"
ON public.lesson_schedules FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

CREATE POLICY "lesson_schedules_delete_policy"
ON public.lesson_schedules FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- ─────────────────────────────────────────────────────────────────
-- system_defaults
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.system_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_defaults_select_policy" ON public.system_defaults;
DROP POLICY IF EXISTS "system_defaults_insert_policy" ON public.system_defaults;
DROP POLICY IF EXISTS "system_defaults_update_policy" ON public.system_defaults;
DROP POLICY IF EXISTS "system_defaults_delete_policy" ON public.system_defaults;

-- All authenticated read (feature flags, default settings)
CREATE POLICY "system_defaults_select_policy"
ON public.system_defaults FOR SELECT
TO authenticated
USING (true);

-- Only admin can mutate system defaults
CREATE POLICY "system_defaults_insert_policy"
ON public.system_defaults FOR INSERT
TO authenticated
WITH CHECK (
  public.get_current_user_role() = 'admin'
);

CREATE POLICY "system_defaults_update_policy"
ON public.system_defaults FOR UPDATE
TO authenticated
USING (
  public.get_current_user_role() = 'admin'
);

CREATE POLICY "system_defaults_delete_policy"
ON public.system_defaults FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() = 'admin'
);
