-- =============================================================
-- Fix infinite RLS recursion between projects ↔ project_members
-- Date: 2026-04-29
--
-- Root cause:
--   projects_select_policy           → SELECT FROM project_members (triggers RLS on members)
--   project_members_select_policy    → SELECT FROM projects        (triggers RLS on projects)
-- → infinite recursion.
--
-- Fix: replace cross-table EXISTS checks with SECURITY DEFINER helper
-- functions that bypass RLS for the membership/ownership lookups.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Helper functions (SECURITY DEFINER → bypass RLS)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_project_member(p_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Drop the recursive policies
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select_policy"        ON public.projects;
DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON public.project_members;
DROP POLICY IF EXISTS "tasks_select_policy"           ON public.tasks;

-- ─────────────────────────────────────────────────────────────
-- 3. Recreate policies using helper functions (no recursion)
-- ─────────────────────────────────────────────────────────────

-- ── projects.SELECT ───────────────────────────────────────────
CREATE POLICY "projects_select_policy"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR owner_id = auth.uid()
    OR public.is_project_member(id)
  );

-- ── project_members.SELECT ────────────────────────────────────
CREATE POLICY "project_members_select_policy"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR user_id = auth.uid()
    OR public.is_project_owner(project_id)
  );

-- ── project_members.INSERT ────────────────────────────────────
CREATE POLICY "project_members_insert_policy"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
  );

-- ── project_members.DELETE ────────────────────────────────────
CREATE POLICY "project_members_delete_policy"
  ON public.project_members FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
  );

-- ── tasks.SELECT (uses both helpers; project_id may be NULL) ──
CREATE POLICY "tasks_select_policy"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assignee_id = auth.uid()
    OR reporter_id = auth.uid()
    OR (project_id IS NOT NULL AND (
      public.is_project_owner(project_id) OR public.is_project_member(project_id)
    ))
  );
