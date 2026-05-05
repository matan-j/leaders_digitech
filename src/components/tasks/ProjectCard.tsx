import { C, PROJECT_TYPE_COLORS, deadlineLabel, deadlineSeverity, progressPct, projectSeverity } from './utils';
import type { ProjectWithStats } from './types';

interface Props {
  project: ProjectWithStats;
  onClick: () => void;
  onOpenTasks: () => void;
}

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
};

export default function ProjectCard({ project, onClick, onOpenTasks }: Props) {
  const sev = projectSeverity(project);
  const pct = progressPct(project.total_tasks, project.done_tasks);
  const deadlineSev = deadlineSeverity(project.deadline);
  const deadlineText = deadlineLabel(project.deadline);
  const typeColor = PROJECT_TYPE_COLORS[project.project_type] || C.gray;

  const deadlineColor =
    deadlineSev === 'overdue' ? C.red :
    deadlineSev === 'today' || deadlineSev === 'soon' ? C.orange :
    C.textSub;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 200,
        transition: 'box-shadow 0.12s, transform 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ height: 4, background: sev.color }} />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {project.blocked_tasks > 0 && (
              <span style={{
                padding: '2px 8px', fontSize: 11, fontWeight: 700,
                color: '#FFFFFF', background: C.red, borderRadius: 999,
                whiteSpace: 'nowrap',
              }}>
                ⛔ {project.blocked_tasks}
              </span>
            )}
            {project.overdue_tasks > 0 && (
              <span style={{
                padding: '2px 8px', fontSize: 11, fontWeight: 700,
                color: '#FFFFFF', background: C.red, borderRadius: 999,
                whiteSpace: 'nowrap',
              }}>
                ⚠ {project.overdue_tasks}
              </span>
            )}
          </div>
        </div>

        {/* Project type pill */}
        <div>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            fontSize: 11, fontWeight: 600,
            color: typeColor,
            background: `${typeColor}15`,
            border: `1px solid ${typeColor}30`,
            borderRadius: 999,
          }}>
            {project.project_type}
          </span>
        </div>

        {/* Progress */}
        <div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: sev.color, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSub }}>
            <span>{pct}% הושלם</span>
            <span>{project.done_tasks}/{project.total_tasks}</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textSub, flexWrap: 'wrap' }}>
          <span>📋 {project.open_tasks} פתוחות</span>
          <span style={{ color: deadlineColor, fontWeight: deadlineSev === 'overdue' || deadlineSev === 'today' ? 600 : 400 }}>
            {deadlineSev === 'none' ? 'ללא דדליין' : deadlineText}
          </span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {project.members.slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                title={m.full_name || m.email || ''}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#E5E7EB', border: '2px solid #FFFFFF',
                  marginRight: i === 0 ? 0 : -8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: C.textSub,
                  zIndex: 3 - i,
                }}
              >
                {initials(m.full_name)}
              </div>
            ))}
            {project.members.length > 3 && (
              <span style={{ marginRight: -8, padding: '4px 8px', fontSize: 10, fontWeight: 600, color: C.textSub, background: '#F3F4F6', borderRadius: 999, border: '2px solid #FFFFFF' }}>
                +{project.members.length - 3}
              </span>
            )}
            {project.members.length === 0 && (
              <span style={{ fontSize: 11, color: C.textSub }}>ללא חברים</span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { stop(e); onOpenTasks(); }}
            style={{
              padding: '6px 12px',
              fontSize: 12, fontWeight: 600,
              color: C.accent, background: '#FFFFFF',
              border: `1px solid ${C.accent}55`,
              borderRadius: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            פתח משימות ←
          </button>
        </div>
      </div>
    </div>
  );
}
