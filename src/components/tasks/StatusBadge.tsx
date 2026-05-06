import { STATUS_COLOR, STATUS_LABEL } from './utils';
import type { TaskStatus } from './types';

interface Props {
  status: TaskStatus;
}

export default function StatusBadge({ status }: Props) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 999,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
