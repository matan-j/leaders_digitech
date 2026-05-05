import { useEffect, useState } from 'react';
import { C, STATUS_LABEL, TASK_TYPES } from './utils';
import { deleteTask, toggleTaskBlocked, updateTask, updateTaskStatus } from './api';
import type { ProfileLite, Project, Task, TaskStatus, TaskType } from './types';
import QuickActions from './QuickActions';
import DeadlinePill from './DeadlinePill';
import TaskComments from './TaskComments';
import { toast } from 'sonner';

interface Props {
  task: Task | null;
  projects: Project[];
  profiles: ProfileLite[];
  canEdit: boolean;
  currentUserId: string;
  isAdminOrPM: boolean;
  onClose: () => void;
  onChange: () => void;
}

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

export default function TaskDrawer({ task, projects, profiles, canEdit, currentUserId, isAdminOrPM, onClose, onChange }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setProjectId(task.project_id ?? '');
      setAssigneeId(task.assignee_id ?? '');
      setDueDate(task.due_date ?? '');
      setStatus(task.status);
      setTaskType(task.task_type ?? '');
      setIsBlocked(task.is_blocked);
      setBlockReason(task.block_reason ?? '');
    }
  }, [task]);

  if (!task) return null;

  const project = projects.find(p => p.id === task.project_id);

  const handleStatus = async (s: TaskStatus) => {
    try {
      await updateTaskStatus(task.id, s);
      setStatus(s);
      toast.success(`סטטוס עודכן: ${STATUS_LABEL[s]}`);
      onChange();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const handleToggleBlocked = async () => {
    const next = !isBlocked;
    try {
      await toggleTaskBlocked(task.id, next, next ? (blockReason || null) : null);
      setIsBlocked(next);
      if (!next) setBlockReason('');
      toast.success(next ? 'המשימה סומנה כחסומה' : 'החסימה הוסרה');
      onChange();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const save = async () => {
    if (!assigneeId) {
      toast.error('משימה חייבת להיות משויכת לעובד');
      return;
    }
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: description || null,
        project_id: projectId || null,
        assignee_id: assigneeId,
        due_date: dueDate || null,
        status,
        task_type: (taskType || null) as TaskType | null,
        is_blocked: isBlocked,
        block_reason: isBlocked ? (blockReason || null) : null,
      });
      toast.success('המשימה נשמרה');
      onChange();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('למחוק את המשימה?')) return;
    try {
      await deleteTask(task.id);
      toast.success('המשימה נמחקה');
      onChange();
      onClose();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    background: '#FFFFFF',
    color: C.text,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: C.textSub,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 90 }} />
      <div
        dir="rtl"
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: 'min(460px, 100vw)',
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {project && <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color }} />}
            <span style={{ fontSize: 12, color: C.textSub }}>{project?.name ?? 'ללא פרויקט'}</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textSub, padding: 4 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick actions */}
          <QuickActions
            status={status}
            isBlocked={isBlocked}
            onStatus={handleStatus}
            onToggleBlocked={handleToggleBlocked}
            size="md"
          />

          {/* Blocked reason — visible when blocked */}
          {isBlocked && (
            <div style={{
              background: '#FEF2F2',
              border: `1px solid ${C.red}55`,
              borderRadius: 8,
              padding: 10,
            }}>
              <label style={{ ...labelStyle, color: C.red }}>סיבת חסימה</label>
              <textarea
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                rows={2}
                placeholder="מה חוסם את ההתקדמות?"
                style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit', background: '#FFFFFF' }}
                disabled={!canEdit}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label style={labelStyle}>כותרת</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
              disabled={!canEdit}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>תיאור</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
              disabled={!canEdit}
            />
          </div>

          {/* 2-col row: status + task_type */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>סטטוס</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} style={inputStyle} disabled={!canEdit}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>סוג</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value as TaskType | '')} style={inputStyle} disabled={!canEdit}>
                <option value="">ללא סוג</option>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Project */}
          <div>
            <label style={labelStyle}>פרויקט</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle} disabled={!canEdit}>
              <option value="">ללא פרויקט</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Assignee — REQUIRED */}
          <div>
            <label style={labelStyle}>משויך ל <span style={{ color: C.red }}>*</span></label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              style={{ ...inputStyle, borderColor: assigneeId ? C.border : `${C.red}88` }}
              disabled={!canEdit}
            >
              <option value="" disabled>בחר עובד...</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label style={labelStyle}>תאריך יעד</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                disabled={!canEdit}
              />
              <DeadlinePill date={dueDate || null} size="md" />
            </div>
          </div>

          {/* Comments */}
          <div style={{ marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <TaskComments
              taskId={task.id}
              currentUserId={currentUserId}
              isAdminOrPM={isAdminOrPM}
              profiles={profiles}
              onActivity={onChange}
            />
          </div>
        </div>

        {/* Footer */}
        {canEdit && (
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              type="button"
              onClick={remove}
              style={{ padding: '8px 14px', fontSize: 12, color: C.red, background: 'none', border: `1px solid ${C.red}55`, borderRadius: 6, cursor: 'pointer' }}
            >
              מחק
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: C.accent, border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
