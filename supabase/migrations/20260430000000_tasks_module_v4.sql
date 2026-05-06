-- =============================================================
-- TASKS & PROJECTS MODULE v4 — Daily Execution Refinement
-- Date: 2026-04-30
-- Additive only. No existing columns dropped.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. projects: project_type (required, hardcoded enum) + info_md
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'תפעול פנימי'
    CHECK (project_type IN (
      'פיתוח מוצר',
      'שיווק / קמפיין',
      'השקת קורס',
      'לקוחות / לידים',
      'פדגוגיה',
      'תפעול פנימי',
      'תוכן ומדיה'
    )),
  ADD COLUMN IF NOT EXISTS info_md TEXT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. tasks: is_blocked, block_reason, task_type
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_blocked   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS block_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS task_type    TEXT NULL
    CHECK (task_type IS NULL OR task_type IN (
      'פיתוח',
      'שיווק',
      'תוכן',
      'מכירות',
      'פגישה / החלטה',
      'אחר'
    ));

-- ─────────────────────────────────────────────────────────────
-- 3. Migrate existing 'blocked' status to todo + is_blocked=true
-- ─────────────────────────────────────────────────────────────
UPDATE public.tasks SET status = 'todo', is_blocked = TRUE WHERE status = 'blocked';

-- ─────────────────────────────────────────────────────────────
-- 4. Replace status CHECK (todo/in_progress/review/done)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'done'));

-- ─────────────────────────────────────────────────────────────
-- 5. task_comments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id        ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_created ON public.task_comments(author_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. project_links
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  url        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_links_project_id ON public.project_links(project_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Index for "did not update today" query
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_updated ON public.tasks(assignee_id, updated_at);

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — task_comments
--    read: anyone who can read the parent task
--    insert/update/delete: author + admin/PM
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select_policy"
  ON public.task_comments FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.reporter_id = auth.uid()
          OR (t.project_id IS NOT NULL AND (
            public.is_project_owner(t.project_id) OR public.is_project_member(t.project_id)
          ))
        )
    )
  );

CREATE POLICY "task_comments_insert_policy"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR author_id = auth.uid()
  );

CREATE POLICY "task_comments_update_policy"
  ON public.task_comments FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR author_id = auth.uid()
  );

CREATE POLICY "task_comments_delete_policy"
  ON public.task_comments FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR author_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — project_links
--    read: members + admin/PM
--    write: project owner + admin/PM
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_links_select_policy"
  ON public.project_links FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
    OR public.is_project_member(project_id)
  );

CREATE POLICY "project_links_insert_policy"
  ON public.project_links FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
  );

CREATE POLICY "project_links_update_policy"
  ON public.project_links FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
  );

CREATE POLICY "project_links_delete_policy"
  ON public.project_links FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR public.is_project_owner(project_id)
  );
