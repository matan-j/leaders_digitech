import { useMemo } from 'react';
import { C, projectSeverity } from './utils';
import type { ProfileLite, Project, ProjectWithStats, Task } from './types';
import ProjectCard from './ProjectCard';
import RecommendedAction from './RecommendedAction';
import InactiveTodayWidget from './InactiveTodayWidget';

interface Props {
  projects: ProjectWithStats[];
  rawProjects: Project[];
  tasks: Task[];
  profiles: ProfileLite[];
  members: { project_id: string; user_id: string }[];
  onProjectOpen: (id: string) => void;
  onProjectBoard: (id: string) => void;
  onAssigneeFilter: (assigneeId: string) => void;
}

export default function Overview({ projects, rawProjects, tasks, profiles, members, onProjectOpen, onProjectBoard, onAssigneeFilter }: Props) {
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let inProgress = 0;
    let doneThisMonth = 0;
    let overdue = 0;
    let soon = 0;

    projects.forEach(p => {
      const sev = projectSeverity(p);
      if (p.status === 'done' && new Date(p.updated_at).getTime() >= monthStart.getTime()) doneThisMonth++;
      if (sev.key === 'red') overdue++;
      else if (sev.key === 'orange') soon++;
      else if (sev.key === 'blue') inProgress++;
    });

    return { inProgress, doneThisMonth, overdue, soon };
  }, [projects]);

  const kpiCard = (label: string, value: number, color: string, emoji: string) => (
    <div style={{
      flex: 1,
      minWidth: 140,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, marginBottom: 8 }}>
        <span aria-hidden style={{ marginLeft: 6 }}>{emoji}</span>{label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  );

  return (
    <div dir="rtl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RecommendedAction
        projects={projects}
        tasks={tasks}
        profiles={profiles}
        onProjectClick={onProjectBoard}
        onAssigneeClick={onAssigneeFilter}
      />

      <InactiveTodayWidget
        profiles={profiles}
        tasks={tasks}
        projects={rawProjects}
        members={members}
        onUserClick={onAssigneeFilter}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {kpiCard('בתהליך', kpis.inProgress, C.blue, '🔵')}
        {kpiCard('הושלמו החודש', kpis.doneThisMonth, C.green, '🟢')}
        {kpiCard('באיחור', kpis.overdue, C.red, '🔴')}
        {kpiCard('קרובים לדדליין', kpis.soon, C.orange, '🟠')}
      </div>

      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, marginBottom: 12 }}>פרויקטים</h2>
        {projects.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontSize: 14, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
            אין פרויקטים עדיין — עבור ללשונית "פרויקטים" כדי ליצור את הראשון
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {projects.map(p => (
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
    </div>
  );
}
