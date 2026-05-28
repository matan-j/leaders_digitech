import type { ProjectType, TaskStatus, TaskType } from './types';

export const C = {
  surface: '#FFFFFF',
  bg: '#F7F8FC',
  border: '#E5E7EB',
  text: '#111827',
  textSub: '#6B7280',
  accent: '#6D28D9',
  green: '#10B981',
  blue: '#3B5BDB',
  orange: '#F59E0B',
  red: '#DC2626',
  gray: '#9CA3AF',
};

export const PROJECT_TYPES: ProjectType[] = [
  'פיתוח מוצר',
  'שיווק / קמפיין',
  'השקת קורס',
  'לקוחות / לידים',
  'פדגוגיה',
  'תפעול פנימי',
  'תוכן ומדיה',
];

export const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  'פיתוח מוצר':     '#3B5BDB',
  'שיווק / קמפיין': '#EC4899',
  'השקת קורס':      '#F59E0B',
  'לקוחות / לידים': '#10B981',
  'פדגוגיה':         '#8B5CF6',
  'תפעול פנימי':     '#6B7280',
  'תוכן ומדיה':      '#06B6D4',
};

export const TASK_TYPES: TaskType[] = [
  'פיתוח',
  'שיווק',
  'תוכן',
  'מכירות',
  'פגישה / החלטה',
  'אחר',
];

export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  'פיתוח':           '#3B5BDB',
  'שיווק':           '#EC4899',
  'תוכן':            '#06B6D4',
  'מכירות':          '#10B981',
  'פגישה / החלטה':  '#F59E0B',
  'אחר':             '#9CA3AF',
};

export const IMPACT_COLOR: Record<'low' | 'medium' | 'high', string> = {
  low: C.green,
  medium: C.orange,
  high: C.red,
};

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff;
}

export type DeadlineSeverity = 'overdue' | 'today' | 'soon' | 'normal' | 'none';

export function deadlineSeverity(date: string | null): DeadlineSeverity {
  const d = daysUntil(date);
  if (d === null) return 'none';
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 7) return 'soon';
  return 'normal';
}

export function deadlineLabel(date: string | null): string {
  const d = daysUntil(date);
  if (d === null) return 'ללא דדליין';
  if (d < 0) return `באיחור ${Math.abs(d)} ימים`;
  if (d === 0) return 'היום';
  if (d === 1) return 'מחר';
  return `${d} ימים נותרו`;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'לעשות',
  in_progress: 'בתהליך',
  review: 'בבדיקה',
  done: 'בוצע',
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: C.gray,
  in_progress: C.blue,
  review: C.orange,
  done: C.green,
};

// Project card severity — most-severe wins (red > orange > blue > green)
export function projectSeverity(args: {
  status: string;
  overdue_tasks: number;
  blocked_tasks?: number;
  deadline: string | null;
  total_tasks: number;
  done_tasks: number;
}): { color: string; key: 'red' | 'orange' | 'blue' | 'green' | 'gray' } {
  const sev = deadlineSeverity(args.deadline);
  if (args.overdue_tasks > 0 || sev === 'overdue') return { color: C.red, key: 'red' };
  if (sev === 'soon' || sev === 'today') return { color: C.orange, key: 'orange' };
  if (args.total_tasks > 0 && args.done_tasks === args.total_tasks) return { color: C.green, key: 'green' };
  if (args.status === 'done') return { color: C.green, key: 'green' };
  if (args.status === 'archived') return { color: C.gray, key: 'gray' };
  return { color: C.blue, key: 'blue' };
}

export function progressPct(total: number, done: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function isToday(date: string | null): boolean {
  return daysUntil(date) === 0;
}

export function isOverdue(date: string | null): boolean {
  const d = daysUntil(date);
  return d !== null && d < 0;
}

export const PROJECT_COLOR_PALETTE = [
  '#3B5BDB', '#10B981', '#F59E0B', '#DC2626',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];
