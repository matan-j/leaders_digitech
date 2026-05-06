import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { C, STATUS_LABEL, STATUS_COLOR, TASK_TYPE_COLORS, deadlineSeverity } from './utils';
import { toggleTaskBlocked, updateTaskStatus } from './api';
import type { ProfileLite, Project, Task, TaskStatus } from './types';
import DeadlinePill from './DeadlinePill';
import QuickAddTask from './QuickAddTask';
import { toast } from 'sonner';

interface Props {
  tasks: Task[];
  projects: Project[];
  profiles: ProfileLite[];
  myUserId: string;
  isAdminOrPM: boolean;
  onTaskClick: (id: string) => void;
  onChange: () => void;
  onProjectOpen?: (id: string) => void;
  projectFilter?: string | null;
  assigneeFilter?: string | null;
  lockProject?: boolean;
  hideProjectPill?: boolean;
  hideFilters?: boolean;
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
type FocusFilter = 'today' | 'overdue' | 'blocked' | null;

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
};

function TaskCard({
  task, projectMap, profileMap, onClick, onProjectOpen, hideProjectPill,
}: {
  task: Task;
  projectMap: Map<string, Project>;
  profileMap: Map<string, ProfileLite>;
  onClick: () => void;
  onProjectOpen?: (id: string) => void;
  hideProjectPill?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const project = task.project_id ? projectMap.get(task.project_id) : null;
  const assignee = task.assignee_id ? profileMap.get(task.assignee_id) : null;

  const sev = deadlineSeverity(task.due_date);
  const isOverdue = sev === 'overdue' && task.status !== 'done';
  const isToday = sev === 'today' && task.status !== 'done';
  const isDone = task.status === 'done';

  const borderLeft = task.is_blocked ? `3px solid ${C.red}` :
    isOverdue ? `4px solid ${C.red}` :
    isToday ? `3px solid ${C.orange}` :
    'none';

  const titleWeight = isOverdue ? 700 : 600;

  const style: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderLeft,
    borderRadius: 8,
    padding: 10,
    cursor: 'grab',
    opacity: isDragging ? 0.5 : (isDone ? 0.65 : 1),
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    position: 'relative',
  };

  const taskTypeColor = task.task_type ? TASK_TYPE_COLORS[task.task_type] : C.gray;

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style} onClick={onClick}>
      {task.is_blocked && (
        <div
          onClick={e => { e.stopPropagation(); onClick(); }}
          style={{
            position: 'absolute',
            top: -8, right: 8,
            padding: '2px 8px',
            fontSize: 10, fontWeight: 700,
            color: '#FFFFFF',
            background: C.red,
            borderRadius: 999,
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
          }}
        >
          ⛔ חסום
        </div>
      )}

      <div style={{
        fontSize: 13,
        fontWeight: titleWeight,
        color: isDone ? C.textSub : C.text,
        textDecoration: isDone ? 'line-through' : 'none',
        lineHeight: 1.3,
        paddingTop: task.is_blocked ? 4 : 0,
      }}>
        {task.title}
      </div>

      {/* Type + project pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {task.task_type && (
          <span style={{
            padding: '1px 7px',
            fontSize: 10, fontWeight: 600,
            color: taskTypeColor,
            background: `${taskTypeColor}15`,
            border: `1px solid ${taskTypeColor}30`,
            borderRadius: 999,
          }}>
            {task.task_type}
          </span>
        )}
        {!hideProjectPill && project && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onProjectOpen?.(project.id); }}
            onPointerDown={e => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 8px',
              fontSize: 10, fontWeight: 500,
              color: C.textSub,
              background: '#FFFFFF',
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              cursor: 'pointer',
            }}
            title="עבור לפרויקט"
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: project.color }} />
            {project.name} ←
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <DeadlinePill date={task.due_date} />
        {assignee && (
          <div
            title={assignee.full_name || assignee.email || ''}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 600, color: C.textSub,
              flexShrink: 0,
            }}
          >
            {initials(assignee.full_name)}
          </div>
        )}
      </div>
    </div>
  );
}

function Column({ status, tasks, children }: { status: TaskStatus; tasks: Task[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STATUS_COLOR[status];
  return (
    <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: C.surface,
        borderTop: `3px solid ${color}`,
        borderLeft: `1px solid ${C.border}`,
        borderRight: `1px solid ${C.border}`,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{STATUS_LABEL[status]}</span>
        <span style={{ fontSize: 12, color: C.textSub, background: '#F3F4F6', padding: '2px 8px', borderRadius: 999 }}>
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 200,
          background: isOver ? `${color}10` : '#F8F9FB',
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          padding: 8,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function TaskBoard({
  tasks, projects, profiles, myUserId, isAdminOrPM, onTaskClick, onChange, onProjectOpen,
  projectFilter, assigneeFilter, lockProject, hideProjectPill, hideFilters,
}: Props) {
  const [filterMode, setFilterMode] = useState<'mine' | 'all' | 'user' | 'project'>(
    isAdminOrPM ? 'all' : 'mine'
  );
  const [filterUserId, setFilterUserId] = useState<string>(assigneeFilter ?? '');
  const [filterProjectId, setFilterProjectId] = useState<string>(projectFilter ?? '');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const effectiveProjectId = lockProject ? (projectFilter ?? '') : filterProjectId;
  const effectiveAssigneeId = filterMode === 'user' ? filterUserId : '';
  const isMine = !lockProject && filterMode === 'mine';

  const filteredTasks = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();

    return tasks.filter(t => {
      if (effectiveProjectId && t.project_id !== effectiveProjectId) return false;
      if (filterMode === 'mine' && !lockProject && t.assignee_id !== myUserId) return false;
      if (filterMode === 'user' && filterUserId && t.assignee_id !== filterUserId) return false;
      // Focus filters (only when in 'mine' mode):
      if (focusFilter && isMine) {
        if (t.status === 'done') return false;
        if (focusFilter === 'overdue') {
          if (!t.due_date) return false;
          if (new Date(t.due_date + 'T00:00:00').getTime() >= todayMs) return false;
        }
        if (focusFilter === 'today') {
          if (!t.due_date) return false;
          if (new Date(t.due_date + 'T00:00:00').getTime() !== todayMs) return false;
        }
        if (focusFilter === 'blocked') {
          if (!t.is_blocked) return false;
        }
      }
      return true;
    });
  }, [tasks, filterMode, lockProject, effectiveProjectId, myUserId, filterUserId, focusFilter, isMine]);

  // Counts for Personal Focus Bar (always computed from full mine subset, not focusFiltered)
  const myCounts = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    const mine = tasks.filter(t => t.assignee_id === myUserId && t.status !== 'done');
    return {
      today: mine.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00').getTime() === todayMs).length,
      overdue: mine.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00').getTime() < todayMs).length,
      blocked: mine.filter(t => t.is_blocked).length,
    };
  }, [tasks, myUserId]);

  const showFocusBar = isMine && (myCounts.today > 0 || myCounts.overdue > 0 || myCounts.blocked > 0);

  const byCol = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    filteredTasks.forEach(t => { map[t.status].push(t); });
    return map;
  }, [filteredTasks]);

  const activeTask = useMemo(() => filteredTasks.find(t => t.id === activeId) ?? null, [filteredTasks, activeId]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const newStatus = e.over.id as TaskStatus;
    const t = filteredTasks.find(x => x.id === taskId);
    if (!t || t.status === newStatus) return;
    try {
      await updateTaskStatus(taskId, newStatus);
      onChange();
    } catch (err: any) {
      toast.error('שגיאה: ' + (err?.message ?? ''));
    }
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: active ? '#FFFFFF' : C.textSub,
    background: active ? C.accent : '#FFFFFF',
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 999,
    cursor: 'pointer',
  });

  const focusBtn = (key: FocusFilter, label: string, count: number, color: string) => {
    const active = focusFilter === key;
    return (
      <button
        type="button"
        onClick={() => setFocusFilter(active ? null : key)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 12, fontWeight: 600,
          color: active ? '#FFFFFF' : color,
          background: active ? color : `${color}15`,
          border: `1px solid ${active ? color : `${color}40`}`,
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <span style={{
          padding: '0 6px',
          background: active ? '#FFFFFF22' : `${color}30`,
          borderRadius: 999,
          fontSize: 11,
        }}>{count}</span>
      </button>
    );
  };

  return (
    <div dir="rtl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters */}
      {!hideFilters && !lockProject && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={chipStyle(filterMode === 'mine')} onClick={() => { setFilterMode('mine'); setFocusFilter(null); }}>שלי</button>
          <button type="button" style={chipStyle(filterMode === 'all')} onClick={() => { setFilterMode('all'); setFocusFilter(null); }}>כולם</button>
          <select
            value={filterMode === 'user' ? filterUserId : ''}
            onChange={e => {
              const v = e.target.value;
              if (v) { setFilterMode('user'); setFilterUserId(v); setFocusFilter(null); }
              else { setFilterMode(isAdminOrPM ? 'all' : 'mine'); setFilterUserId(''); }
            }}
            style={{
              padding: '5px 10px', fontSize: 12,
              border: `1px solid ${filterMode === 'user' ? C.accent : C.border}`,
              borderRadius: 999,
              background: filterMode === 'user' ? `${C.accent}10` : '#FFFFFF',
              color: filterMode === 'user' ? C.accent : C.textSub,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            <option value="">לפי עובד...</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
          <select
            value={filterMode === 'project' ? filterProjectId : ''}
            onChange={e => {
              const v = e.target.value;
              if (v) { setFilterMode('project'); setFilterProjectId(v); setFocusFilter(null); }
              else { setFilterMode(isAdminOrPM ? 'all' : 'mine'); setFilterProjectId(''); }
            }}
            style={{
              padding: '5px 10px', fontSize: 12,
              border: `1px solid ${filterMode === 'project' ? C.accent : C.border}`,
              borderRadius: 999,
              background: filterMode === 'project' ? `${C.accent}10` : '#FFFFFF',
              color: filterMode === 'project' ? C.accent : C.textSub,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            <option value="">לפי פרויקט...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Personal Focus Bar (only when filter = שלי AND has urgent items) */}
      {showFocusBar && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginLeft: 4 }}>
            מה עליי לעשות עכשיו:
          </span>
          {myCounts.today > 0 && focusBtn('today', 'היום', myCounts.today, C.orange)}
          {myCounts.overdue > 0 && focusBtn('overdue', 'באיחור', myCounts.overdue, C.red)}
          {myCounts.blocked > 0 && focusBtn('blocked', 'חסומות', myCounts.blocked, C.red)}
        </div>
      )}

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {COLUMNS.map(col => (
            <Column key={col} status={col} tasks={byCol[col]}>
              <div style={{ marginBottom: 4 }}>
                <QuickAddTask
                  reporterId={myUserId}
                  projects={projects}
                  profiles={profiles}
                  onCreated={onChange}
                  variant="inline"
                  lockedProjectId={effectiveProjectId || undefined}
                  lockedStatus={col}
                  triggerLabel="הוסף משימה"
                />
              </div>
              {byCol[col].length === 0 ? (
                <div style={{ fontSize: 11, color: C.textSub, textAlign: 'center', padding: 12 }}>—</div>
              ) : (
                byCol[col].map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectMap={projectMap}
                    profileMap={profileMap}
                    onClick={() => onTaskClick(t.id)}
                    onProjectOpen={onProjectOpen}
                    hideProjectPill={hideProjectPill}
                  />
                ))
              )}
            </Column>
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              projectMap={projectMap}
              profileMap={profileMap}
              onClick={() => {}}
              hideProjectPill={hideProjectPill}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
