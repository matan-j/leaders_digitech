-- =============================================================
-- TASKS & PROJECTS MODULE — Full Schema Migration
-- Date: 2026-04-28
-- Additive only. No existing columns modified or dropped.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#3B5BDB',
  deadline    DATE,
  status      TEXT        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'done', 'archived')),
  owner_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);

-- ─────────────────────────────────────────────────────────────
-- 2. project_members — many-to-many users ↔ projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. tasks
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  assignee_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date      DATE,
  order_index   INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id  ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reporter_id ON public.tasks(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON public.tasks(due_date);

-- ─────────────────────────────────────────────────────────────
-- 4. Enable RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks           ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS Policies
--
-- Access model:
--   admin / pedagogical_manager → full CRUD on everything
--   instructor / sales_rep      → read projects they own or are members of
--                                 read tasks where they are assignee or reporter,
--                                   or where the project is theirs
--                                 create/update tasks they own or are assignee
-- ─────────────────────────────────────────────────────────────

-- ── projects ──────────────────────────────────────────────────
CREATE POLICY "projects_select_policy"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "projects_insert_policy"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR owner_id = auth.uid()
  );

CREATE POLICY "projects_update_policy"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR owner_id = auth.uid()
  );

CREATE POLICY "projects_delete_policy"
  ON public.projects FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── project_members ───────────────────────────────────────────
CREATE POLICY "project_members_select_policy"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "project_members_insert_policy"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "project_members_delete_policy"
  ON public.project_members FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  );

-- ── tasks ─────────────────────────────────────────────────────
CREATE POLICY "tasks_select_policy"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assignee_id = auth.uid()
    OR reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "tasks_insert_policy"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR reporter_id = auth.uid()
  );

CREATE POLICY "tasks_update_policy"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assignee_id = auth.uid()
    OR reporter_id = auth.uid()
  );

CREATE POLICY "tasks_delete_policy"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR reporter_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- 6. updated_at trigger (reuse pattern from existing schema)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
