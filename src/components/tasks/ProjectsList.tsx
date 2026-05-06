import { useMemo, useState } from 'react';
import { C, projectSeverity } from './utils';
import type { ProjectWithStats } from './types';
import ProjectCard from './ProjectCard';

interface Props {
  projects: ProjectWithStats[];
  onProjectOpen: (id: string) => void;
  onProjectBoard: (id: string) => void;
  onCreateProject: () => void;
}

type Filter = 'all' | 'active' | 'overdue' | 'soon' | 'done';

const FILTER_LABEL: Record<Filter, string> = {
  all: 'הכל',
  active: 'בתהליך',
  overdue: 'באיחור',
  soon: 'קרובים לדדליין',
  done: 'הושלמו',
};

export default function ProjectsList({ projects, onProjectOpen, onProjectBoard, onCreateProject }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const sev = projectSeverity(p);
      if (filter === 'all') return true;
      if (filter === 'overdue') return sev.key === 'red';
      if (filter === 'soon') return sev.key === 'orange';
      if (filter === 'done') return sev.key === 'green';
      if (filter === 'active') return sev.key === 'blue';
      return true;
    });
  }, [projects, filter]);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: active ? '#FFFFFF' : C.textSub,
    background: active ? C.accent : '#FFFFFF',
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 999,
    cursor: 'pointer',
  });

  return (
    <div dir="rtl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters + create */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(FILTER_LABEL) as Filter[]).map(f => (
            <button key={f} type="button" style={chipStyle(filter === f)} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCreateProject}
          style={{
            padding: '8px 16px',
            background: C.accent,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + פרויקט חדש
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: C.textSub, fontSize: 14 }}>
          {projects.length === 0 ? 'אין פרויקטים עדיין — צור את הראשון' : 'אין פרויקטים בקטגוריה זו'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => onProjectOpen(p.id)}
              onOpenTasks={() => onProjectBoard(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
