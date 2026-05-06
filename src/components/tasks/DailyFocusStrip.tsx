import { useMemo } from 'react';
import { C } from './utils';
import type { Task } from './types';

interface Props {
  myTasks: Task[];
  onClickOverdue: () => void;
  onClickToday: () => void;
  onClickUrgent: (taskId: string) => void;
}

export default function DailyFocusStrip({ myTasks, onClickOverdue, onClickToday, onClickUrgent }: Props) {
  const { overdue, dueToday, urgent } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const open = myTasks.filter(t => t.status !== 'done');
    const overdue = open.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00').getTime() < todayMs);
    const dueToday = open.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00').getTime() === todayMs);

    const urgent =
      [...overdue].sort((a, b) => (a.due_date! > b.due_date! ? -1 : 1))[0] ??
      [...dueToday][0] ??
      null;

    return { overdue, dueToday, urgent };
  }, [myTasks]);

  if (overdue.length === 0 && dueToday.length === 0 && !urgent) return null;

  const slot: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    fontSize: 13,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.text,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '0 16px',
      gap: 4,
    }}>
      {overdue.length > 0 && (
        <button type="button" onClick={onClickOverdue} style={slot}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red }} />
          <span style={{ color: C.red, fontWeight: 700 }}>באיחור: {overdue.length}</span>
        </button>
      )}
      {(overdue.length > 0 && (dueToday.length > 0 || urgent)) && (
        <span style={{ color: C.border }}>|</span>
      )}
      {dueToday.length > 0 && (
        <button type="button" onClick={onClickToday} style={slot}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} />
          <span style={{ color: C.orange, fontWeight: 700 }}>להיום: {dueToday.length}</span>
        </button>
      )}
      {(dueToday.length > 0 && urgent) && (
        <span style={{ color: C.border }}>|</span>
      )}
      {urgent && (
        <button type="button" onClick={() => onClickUrgent(urgent.id)} style={slot}>
          <span aria-hidden>⚡</span>
          <span style={{ color: C.textSub }}>דחוף עכשיו:</span>
          <span style={{ fontWeight: 600, color: C.accent }}>{urgent.title}</span>
          <span style={{ color: C.accent }}>←</span>
        </button>
      )}
    </div>
  );
}
