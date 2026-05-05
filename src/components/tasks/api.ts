import { supabase } from '@/integrations/supabase/client';
import type {
  InactiveUser,
  ProfileLite,
  Project,
  ProjectLink,
  ProjectWithStats,
  Task,
  TaskComment,
  TaskStatus,
  TaskType,
  ProjectType,
} from './types';

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await (supabase as any)
    .from('tasks')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchProfiles(): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileLite[];
}

export async function fetchProjectMembers(): Promise<{ project_id: string; user_id: string }[]> {
  const { data, error } = await (supabase as any)
    .from('project_members')
    .select('project_id, user_id');
  if (error) throw error;
  return data ?? [];
}

export interface NewTaskInput {
  title: string;
  project_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  description?: string | null;
  status?: TaskStatus;
  task_type?: TaskType | null;
}

export async function createTask(input: NewTaskInput, reporterId: string): Promise<Task> {
  const payload = {
    title: input.title,
    project_id: input.project_id || null,
    assignee_id: input.assignee_id || reporterId,
    due_date: input.due_date || null,
    description: input.description || null,
    reporter_id: reporterId,
    status: input.status ?? 'todo',
    order_index: 0,
    task_type: input.task_type ?? null,
  };
  const { data, error } = await (supabase as any)
    .from('tasks')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await (supabase as any)
    .from('tasks')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function toggleTaskBlocked(id: string, isBlocked: boolean, reason?: string | null): Promise<void> {
  const patch: Record<string, unknown> = { is_blocked: isBlocked };
  if (reason !== undefined) patch.block_reason = reason;
  if (!isBlocked) patch.block_reason = null;
  const { error } = await (supabase as any)
    .from('tasks')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const { error } = await (supabase as any)
    .from('tasks')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export interface NewProjectInput {
  name: string;
  color?: string;
  deadline: string;
  description?: string | null;
  project_type: ProjectType;
}

export async function createProject(input: NewProjectInput, ownerId: string): Promise<Project> {
  const payload = {
    name: input.name,
    color: input.color || '#3B5BDB',
    deadline: input.deadline,
    description: input.description || null,
    owner_id: ownerId,
    status: 'active',
    project_type: input.project_type,
  };
  const { data, error } = await (supabase as any)
    .from('projects')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const { error } = await (supabase as any)
    .from('projects')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function addProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Task comments ────────────────────────────────────────────
export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await (supabase as any)
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskComment[];
}

export async function createTaskComment(taskId: string, authorId: string, body: string): Promise<TaskComment> {
  const { data, error } = await (supabase as any)
    .from('task_comments')
    .insert({ task_id: taskId, author_id: authorId, body })
    .select()
    .single();
  if (error) throw error;
  return data as TaskComment;
}

export async function deleteTaskComment(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('task_comments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Project links ────────────────────────────────────────────
export async function fetchProjectLinks(projectId: string): Promise<ProjectLink[]> {
  const { data, error } = await (supabase as any)
    .from('project_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectLink[];
}

export async function createProjectLink(projectId: string, label: string, url: string): Promise<ProjectLink> {
  const { data, error } = await (supabase as any)
    .from('project_links')
    .insert({ project_id: projectId, label, url })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectLink;
}

export async function deleteProjectLink(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('project_links')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Inactive users today ─────────────────────────────────────
// Definition: user with ≥1 open task assigned OR is a member of an active project,
// AND no tasks.updated_at >= today AND no task_comments.created_at >= today.
export async function fetchInactiveUsersToday(args: {
  profiles: ProfileLite[];
  tasks: Task[];
  members: { project_id: string; user_id: string }[];
  projects: Project[];
  comments: { author_id: string | null; created_at: string }[];
}): Promise<InactiveUser[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const activeProjectIds = new Set(args.projects.filter(p => p.status === 'active').map(p => p.id));
  const memberOfActive = new Set(
    args.members.filter(m => activeProjectIds.has(m.project_id)).map(m => m.user_id)
  );

  const lastTaskUpdate = new Map<string, string>();
  const openTasksByAssignee = new Map<string, number>();
  args.tasks.forEach(t => {
    if (t.assignee_id) {
      if (t.status !== 'done') {
        openTasksByAssignee.set(t.assignee_id, (openTasksByAssignee.get(t.assignee_id) ?? 0) + 1);
      }
      const prev = lastTaskUpdate.get(t.assignee_id);
      if (!prev || prev < t.updated_at) lastTaskUpdate.set(t.assignee_id, t.updated_at);
    }
  });

  const lastComment = new Map<string, string>();
  args.comments.forEach(c => {
    if (!c.author_id) return;
    const prev = lastComment.get(c.author_id);
    if (!prev || prev < c.created_at) lastComment.set(c.author_id, c.created_at);
  });

  const result: InactiveUser[] = [];
  args.profiles.forEach(p => {
    const hasOpenTask = (openTasksByAssignee.get(p.id) ?? 0) > 0;
    const inActiveProject = memberOfActive.has(p.id);
    if (!hasOpenTask && !inActiveProject) return;

    const lastTaskMs = lastTaskUpdate.get(p.id) ? new Date(lastTaskUpdate.get(p.id)!).getTime() : 0;
    const lastCommentMs = lastComment.get(p.id) ? new Date(lastComment.get(p.id)!).getTime() : 0;
    const updatedToday = lastTaskMs >= todayMs || lastCommentMs >= todayMs;
    if (updatedToday) return;

    result.push({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: null,
      last_task_update: lastTaskUpdate.get(p.id) ?? null,
      last_comment: lastComment.get(p.id) ?? null,
    });
  });

  return result;
}

export async function fetchAllRecentComments(): Promise<{ author_id: string | null; created_at: string }[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data, error } = await (supabase as any)
    .from('task_comments')
    .select('author_id, created_at')
    .gte('created_at', since.toISOString());
  if (error) throw error;
  return data ?? [];
}

// ─── Stats builder ────────────────────────────────────────────
export function buildProjectsWithStats(
  projects: Project[],
  tasks: Task[],
  members: { project_id: string; user_id: string }[],
  profiles: ProfileLite[]
): ProjectWithStats[] {
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return projects.map(project => {
    const projTasks = tasks.filter(t => t.project_id === project.id);
    const total_tasks = projTasks.length;
    const done_tasks = projTasks.filter(t => t.status === 'done').length;
    const open_tasks = projTasks.filter(t => t.status !== 'done').length;
    const overdue_tasks = projTasks.filter(t => {
      if (t.status === 'done') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date + 'T00:00:00').getTime() < today.getTime();
    }).length;
    const blocked_tasks = projTasks.filter(t => t.is_blocked && t.status !== 'done').length;
    const memberIds = members.filter(m => m.project_id === project.id).map(m => m.user_id);
    const memberProfiles = memberIds
      .map(id => profileMap.get(id))
      .filter((p): p is ProfileLite => Boolean(p));
    return {
      ...project,
      total_tasks,
      done_tasks,
      open_tasks,
      overdue_tasks,
      blocked_tasks,
      members: memberProfiles,
    };
  });
}
