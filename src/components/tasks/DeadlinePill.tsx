import { C, deadlineLabel, deadlineSeverity } from './utils';

interface Props {
  date: string | null;
  size?: 'sm' | 'md';
}

const STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  overdue: { bg: C.red,    fg: '#FFFFFF', border: C.red },
  today:   { bg: '#FEF3C7', fg: C.orange, border: C.orange },
  soon:    { bg: '#FEF3C7', fg: C.orange, border: C.orange },
  normal:  { bg: '#F3F4F6', fg: C.textSub, border: C.border },
  none:    { bg: 'transparent', fg: C.textSub, border: 'transparent' },
};

export default function DeadlinePill({ date, size = 'sm' }: Props) {
  const sev = deadlineSeverity(date);
  const label = deadlineLabel(date);
  const s = STYLES[sev];
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '3px 8px' : '5px 12px';
  const fontWeight = sev === 'overdue' || sev === 'today' ? 600 : 500;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        fontSize,
        fontWeight,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {sev !== 'none' && <span aria-hidden>{sev === 'overdue' ? '⚠' : '⏱'}</span>}
      {label}
    </span>
  );
}
