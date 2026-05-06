import { C } from './utils';
import type { TaskStatus } from './types';

interface Props {
  status: TaskStatus;
  isBlocked: boolean;
  onStatus: (next: TaskStatus) => void;
  onToggleBlocked: () => void;
  size?: 'sm' | 'md';
}

const BTN_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: '#FFFFFF',
  transition: 'all 0.12s ease',
};

export default function QuickActions({ status, isBlocked, onStatus, onToggleBlocked, size = 'sm' }: Props) {
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '4px 10px' : '6px 14px';

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div style={{ display: 'flex', gap: 6 }} onClick={stop}>
      {status === 'todo' && (
        <button
          type="button"
          onClick={() => onStatus('in_progress')}
          style={{ ...BTN_BASE, padding, fontSize, color: C.blue, borderColor: `${C.blue}55` }}
          title="התחל"
        >
          ▶ התחל
        </button>
      )}
      {status !== 'done' && (
        <button
          type="button"
          onClick={() => onStatus('done')}
          style={{ ...BTN_BASE, padding, fontSize, color: C.green, borderColor: `${C.green}55` }}
          title="סיים"
        >
          ✓ סיים
        </button>
      )}
      {status !== 'done' && (
        <button
          type="button"
          onClick={onToggleBlocked}
          style={{
            ...BTN_BASE,
            padding,
            fontSize,
            color: isBlocked ? '#FFFFFF' : C.red,
            background: isBlocked ? C.red : '#FFFFFF',
            borderColor: isBlocked ? C.red : `${C.red}55`,
          }}
          title={isBlocked ? 'בטל חסימה' : 'חסום'}
        >
          {isBlocked ? '⛔ בטל חסימה' : '⛔ חסום'}
        </button>
      )}
      {status === 'done' && (
        <button
          type="button"
          onClick={() => onStatus('todo')}
          style={{ ...BTN_BASE, padding, fontSize, color: C.textSub, borderColor: C.border }}
          title="פתח מחדש"
        >
          ↺ פתח
        </button>
      )}
    </div>
  );
}
