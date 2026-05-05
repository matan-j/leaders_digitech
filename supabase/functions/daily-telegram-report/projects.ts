// supabase/functions/daily-telegram-report/projects.ts
// Builds the Projects & Tasks portion of the daily report.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js';

export interface ProjectActivity {
  project_id: string;
  project_name: string;
  task_updates: number;
  tasks_completed: number;
  tasks_blocked: number;
  tasks_unblocked: number;
  tasks_created: number;
  comments_added: number;
}

export interface AssigneeOpenStats {
  user_id: string;
  full_name: string | null;
  open_total: number;
  in_review: number;
  overdue: number;
}

export interface ProjectsReport {
  windowStart: string;
  windowEnd: string;
  active: ProjectActivity[];   // sorted by total activity desc
  inactive: { id: string; name: string }[];
  openByAssignee: AssigneeOpenStats[];
  totalOpen: number;
  blockedByProject: { project_id: string | null; project_name: string; count: number }[];
  overdueByProject: { project_id: string | null; project_name: string; count: number }[];
}

interface MinimalTask {
  id: string;
  project_id: string | null;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

interface MinimalProject {
  id: string;
  name: string;
  status: string;
}

interface MinimalProfile {
  id: string;
  full_name: string | null;
}

interface MinimalComment {
  task_id: string;
  created_at: string;
}

const NO_PROJECT_LABEL = 'ללא פרויקט';

export async function getProjectsProgressReport(
  supabase: SupabaseClient,
  windowStart: Date,
  windowEnd: Date
): Promise<ProjectsReport> {
  const startIso = windowStart.toISOString();
  const endIso = windowEnd.toISOString();

  const [{ data: projectsData }, { data: tasksData }, { data: profilesData }, { data: commentsData }] =
    await Promise.all([
      supabase.from('projects').select('id, name, status').neq('status', 'archived'),
      supabase.from('tasks').select('id, project_id, status, assignee_id, due_date, is_blocked, created_at, updated_at'),
      supabase.from('profiles').select('id, full_name'),
      supabase
        .from('task_comments')
        .select('task_id, created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
    ]);

  const projects = (projectsData ?? []) as MinimalProject[];
  const tasks = (tasksData ?? []) as MinimalTask[];
  const profiles = (profilesData ?? []) as MinimalProfile[];
  const comments = (commentsData ?? []) as MinimalComment[];

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Per-project activity counters
  const activityMap = new Map<string, ProjectActivity>();
  const ensureBucket = (projectId: string): ProjectActivity => {
    let b = activityMap.get(projectId);
    if (!b) {
      const proj = projectMap.get(projectId);
      b = {
        project_id: projectId,
        project_name: proj?.name ?? NO_PROJECT_LABEL,
        task_updates: 0,
        tasks_completed: 0,
        tasks_blocked: 0,
        tasks_unblocked: 0,
        tasks_created: 0,
        comments_added: 0,
      };
      activityMap.set(projectId, b);
    }
    return b;
  };

  // Tasks updated within window
  for (const t of tasks) {
    if (!t.project_id) continue;
    const updatedMs = new Date(t.updated_at).getTime();
    const createdMs = new Date(t.created_at).getTime();
    const inWindow = updatedMs >= windowStart.getTime() && updatedMs <= windowEnd.getTime();
    const createdInWindow = createdMs >= windowStart.getTime() && createdMs <= windowEnd.getTime();

    if (inWindow || createdInWindow) {
      const b = ensureBucket(t.project_id);
      if (createdInWindow) b.tasks_created++;
      else b.task_updates++;
      if (inWindow && t.status === 'done') b.tasks_completed++;
      // is_blocked: we can't tell direction (blocked/unblocked) without history,
      // so report current is_blocked state for tasks that updated in-window.
      if (inWindow && t.is_blocked) b.tasks_blocked++;
    }
  }

  // Comments in window
  for (const c of comments) {
    const t = taskMap.get(c.task_id);
    if (!t || !t.project_id) continue;
    const b = ensureBucket(t.project_id);
    b.comments_added++;
  }

  const totalActivity = (a: ProjectActivity) =>
    a.task_updates + a.tasks_completed + a.tasks_blocked + a.tasks_created + a.comments_added;

  const active = Array.from(activityMap.values()).sort((a, b) => totalActivity(b) - totalActivity(a));

  // Inactive: active projects with zero activity
  const activeProjectIdsWithActivity = new Set(active.map(a => a.project_id));
  const inactive = projects
    .filter(p => p.status === 'active' && !activeProjectIdsWithActivity.has(p.id))
    .map(p => ({ id: p.id, name: p.name }));

  // ─── Open tasks snapshot ────────────────────────────────────
  const openTasks = tasks.filter(t => t.status !== 'done');
  const totalOpen = openTasks.length;

  const today = new Date(windowEnd);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const byAssignee = new Map<string, AssigneeOpenStats>();
  for (const t of openTasks) {
    if (!t.assignee_id) continue;
    let bucket = byAssignee.get(t.assignee_id);
    if (!bucket) {
      bucket = {
        user_id: t.assignee_id,
        full_name: profileMap.get(t.assignee_id)?.full_name ?? null,
        open_total: 0,
        in_review: 0,
        overdue: 0,
      };
      byAssignee.set(t.assignee_id, bucket);
    }
    bucket.open_total++;
    if (t.status === 'review') bucket.in_review++;
    if (t.due_date && new Date(t.due_date + 'T00:00:00').getTime() < todayMs) bucket.overdue++;
  }
  const openByAssignee = Array.from(byAssignee.values()).sort((a, b) => b.open_total - a.open_total);

  // Blocked grouped by project
  const blockedAcc = new Map<string, number>();
  for (const t of openTasks) {
    if (!t.is_blocked) continue;
    const k = t.project_id ?? '__none__';
    blockedAcc.set(k, (blockedAcc.get(k) ?? 0) + 1);
  }
  const blockedByProject = Array.from(blockedAcc.entries())
    .map(([k, count]) => ({
      project_id: k === '__none__' ? null : k,
      project_name: k === '__none__' ? NO_PROJECT_LABEL : projectMap.get(k)?.name ?? NO_PROJECT_LABEL,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Overdue grouped by project
  const overdueAcc = new Map<string, number>();
  for (const t of openTasks) {
    if (!t.due_date) continue;
    if (new Date(t.due_date + 'T00:00:00').getTime() >= todayMs) continue;
    const k = t.project_id ?? '__none__';
    overdueAcc.set(k, (overdueAcc.get(k) ?? 0) + 1);
  }
  const overdueByProject = Array.from(overdueAcc.entries())
    .map(([k, count]) => ({
      project_id: k === '__none__' ? null : k,
      project_name: k === '__none__' ? NO_PROJECT_LABEL : projectMap.get(k)?.name ?? NO_PROJECT_LABEL,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    windowStart: startIso,
    windowEnd: endIso,
    active,
    inactive,
    openByAssignee,
    totalOpen,
    blockedByProject,
    overdueByProject,
  };
}
