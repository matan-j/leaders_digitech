export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type ProjectStatus = 'active' | 'done' | 'archived';

export type ProjectType =
  | 'פיתוח מוצר'
  | 'שיווק / קמפיין'
  | 'השקת קורס'
  | 'לקוחות / לידים'
  | 'פדגוגיה'
  | 'תפעול פנימי'
  | 'תוכן ומדיה';

export type TaskType =
  | 'פיתוח'
  | 'שיווק'
  | 'תוכן'
  | 'מכירות'
  | 'פגישה / החלטה'
  | 'אחר';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  deadline: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  project_type: ProjectType;
  info_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  reporter_id: string | null;
  due_date: string | null;
  order_index: number;
  is_blocked: boolean;
  block_reason: string | null;
  task_type: TaskType | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  added_at: string;
}

export interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface ProjectLink {
  id: string;
  project_id: string;
  label: string;
  url: string;
  created_at: string;
}

export interface ProjectWithStats extends Project {
  total_tasks: number;
  done_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  blocked_tasks: number;
  members: ProfileLite[];
}

export interface InactiveUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  last_task_update: string | null;
  last_comment: string | null;
}

export type TasksTab = 'overview' | 'board' | 'projects';
