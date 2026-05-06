import { useEffect, useRef, useState } from 'react';
import { C, TASK_TYPES } from './utils';
import { createTask, type NewTaskInput } from './api';
import type { ProfileLite, Project, TaskStatus, TaskType } from './types';
import { toast } from 'sonner';

interface Props {
  reporterId: string;
  projects: Project[];
  profiles: ProfileLite[];
  onCreated: () => void;
  variant?: 'header' | 'fab' | 'inline';
  lockedProjectId?: string;
  lockedStatus?: TaskStatus;
  triggerLabel?: string;
}

export default function QuickAddTask({
  reporterId,
  projects,
  profiles,
  onCreated,
  variant = 'header',
  lockedProjectId,
  lockedStatus,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string>(lockedProjectId ?? '');
  const [assigneeId, setAssigneeId] = useState<string>(reporterId);
  const [dueDate, setDueDate] = useState<string>('');
  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setAssigneeId(reporterId); }, [reporterId]);
  useEffect(() => { if (lockedProjectId) setProjectId(lockedProjectId); }, [lockedProjectId]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const reset = () => {
    setTitle('');
    setProjectId(lockedProjectId ?? '');
    setAssigneeId(reporterId);
    setDueDate('');
    setTaskType('');
  };

  const submit = async (keepOpen: boolean) => {
    const t = title.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      const input: NewTaskInput = {
        title: t,
        project_id: lockedProjectId ?? projectId ?? null,
        assignee_id: assigneeId || reporterId,
        due_date: dueDate || null,
        status: lockedStatus,
        task_type: (taskType || null) as TaskType | null,
      };
      await createTask(input, reporterId);
      toast.success('המשימה נוספה ✓');
      onCreated();
      reset();
      if (!keepOpen) setOpen(false);
      titleRef.current?.focus();
    } catch (err: any) {
      toast.error('שגיאה בהוספת משימה: ' + (err?.message ?? 'unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(e.shiftKey);
    }
  };

  const buttonStyle: React.CSSProperties = (() => {
    if (variant === 'fab') {
      return {
        position: 'fixed',
        bottom: 20, left: 20,
        width: 56, height: 56,
        borderRadius: '50%',
        background: C.accent,
        color: '#FFFFFF',
        border: 'none',
        boxShadow: '0 4px 12px rgba(59,91,219,0.35)',
        fontSize: 28, fontWeight: 300,
        cursor: 'pointer',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      };
    }
    if (variant === 'inline') {
      return {
        padding: '6px 12px',
        background: '#FFFFFF',
        color: C.accent,
        border: `1px dashed ${C.accent}66`,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        width: '100%',
        justifyContent: 'center',
      };
    }
    // header
    return {
      padding: '8px 16px',
      background: C.accent,
      color: '#FFFFFF',
      border: 'none',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    };
  })();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    background: '#FFFFFF',
    color: C.text,
    direction: 'rtl' as const,
  };

  const label = triggerLabel ?? (variant === 'fab' ? '+' : 'משימה חדשה');

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: variant === 'fab' ? 'block' : 'inline-block', width: variant === 'inline' ? '100%' : 'auto' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={buttonStyle} title="משימה חדשה">
        {variant === 'fab'
          ? '+'
          : <><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {label}</>}
      </button>
      {open && (
        <div
          style={{
            position: variant === 'fab' ? 'fixed' : 'absolute',
            top: variant === 'fab' ? 'auto' : '110%',
            bottom: variant === 'fab' ? 90 : 'auto',
            left: variant === 'fab' ? 20 : 'auto',
            right: variant === 'fab' ? 'auto' : 0,
            width: 300,
            maxWidth: 'calc(100vw - 32px)',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 12,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <input
            ref={titleRef}
            type="text"
            placeholder="כותרת המשימה..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={onKey}
            style={{ ...inputStyle, fontSize: 14, fontWeight: 500 }}
          />
          {!lockedProjectId && (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">ללא פרויקט</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            style={inputStyle}
          >
            <option value={reporterId}>אני</option>
            {profiles.filter(p => p.id !== reporterId).map(p => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value as TaskType | '')}
            style={inputStyle}
          >
            <option value="">סוג משימה (אופציונלי)</option>
            {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            onKeyDown={onKey}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!title.trim() || submitting}
            style={{
              padding: '8px 12px',
              background: title.trim() ? C.accent : '#E5E7EB',
              color: title.trim() ? '#FFFFFF' : C.textSub,
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'מוסיף...' : 'הוסף'}
          </button>
          <div style={{ fontSize: 10, color: C.textSub, textAlign: 'center' }}>
            Enter להוספה • Shift+Enter להזנה רציפה
          </div>
        </div>
      )}
    </div>
  );
}
