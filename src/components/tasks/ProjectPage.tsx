import { useMemo, useState } from 'react';
import { C, deadlineLabel, deadlineSeverity, progressPct } from './utils';
import type { ProfileLite, Project, ProjectWithStats, Task } from './types';
import TaskBoard from './TaskBoard';
import QuickAddTask from './QuickAddTask';
import ProjectInfoTab from './ProjectInfoTab';

interface Props {
  project: ProjectWithStats;
  tasks: Task[];
  profiles: ProfileLite[];
  myUserId: string;
  isAdminOrPM: boolean;
  onBack: () => void;
  onTaskClick: (id: string) => void;
  onChange: () => void;
}

type ProjectInnerTab = 'board' | 'info';

export default function ProjectPage({ project, tasks, profiles, myUserId, isAdminOrPM, onBack, onTaskClick, onChange }: Props) {
  const [innerTab, setInnerTab] = useState<ProjectInnerTab>('board');

  const sev = deadlineSeverity(project.deadline);
  const ribbon =
    sev === 'overdue' ? { bg: C.red, fg: '#FFFFFF' } :
    sev === 'today' || sev === 'soon' ? { bg: '#FEF3C7', fg: C.orange } :
    { bg: '#F3F4F6', fg: C.textSub };

  const pct = progressPct(project.total_tasks, project.done_tasks);
  const projectTasks = useMemo(() => tasks.filter(t => t.project_id === project.id), [tasks, project.id]);
  const canEdit = isAdminOrPM || project.owner_id === myUserId;

  const miniKpi = (label: string, value: number, color: string) => (
    <div style={{
      flex: 1, minWidth: 100,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 10, color: C.textSub, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
    </div>
  );

  const tabBtn = (id: ProjectInnerTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setInnerTab(id)}
      style={{
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: innerTab === id ? 600 : 400,
        color: innerTab === id ? C.accent : C.textSub,
        borderBottom: innerTab === id ? `2px solid ${C.accent}` : '2px solid transparent',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        marginBottom: -1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div dir="rtl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Back + quick add */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: '6px 12px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: C.textSub }}
        >
          → חזרה לכל הפרויקטים
        </button>
        <QuickAddTask
          reporterId={myUserId}
          projects={[project as Project]}
          profiles={profiles}
          onCreated={onChange}
          variant="header"
          lockedProjectId={project.id}
          triggerLabel="משימה לפרויקט"
        />
      </div>

      {/* Header */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: project.color }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{project.name}</h1>
          <span style={{
            padding: '3px 12px',
            fontSize: 12, fontWeight: 600,
            color: C.textSub,
            background: '#F3F4F6',
            borderRadius: 999,
          }}>
            {project.project_type}
          </span>
        </div>

        <div
          style={{
            padding: '8px 14px',
            background: ribbon.bg,
            color: ribbon.fg,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            display: 'inline-block',
            alignSelf: 'flex-start',
          }}
        >
          {sev === 'none' ? 'ללא דדליין' : `${deadlineLabel(project.deadline)}${project.deadline ? ` • ${project.deadline}` : ''}`}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {miniKpi('סך הכל', project.total_tasks, C.text)}
          {miniKpi('הושלמו', project.done_tasks, C.green)}
          {miniKpi('פתוחות', project.open_tasks, C.blue)}
          {miniKpi('באיחור', project.overdue_tasks, C.red)}
          {miniKpi('חסומות', project.blocked_tasks, C.red)}
        </div>

        <div>
          <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: project.color, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: C.textSub }}>{pct}% הושלם</div>
        </div>
      </div>

      {/* Inner sub-nav */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
        }}>
          {tabBtn('board', 'לוח משימות')}
          {tabBtn('info', 'מידע וקישורים')}
        </div>

        <div>
          {innerTab === 'board' ? (
            <TaskBoard
              tasks={projectTasks}
              projects={[project as Project]}
              profiles={profiles}
              myUserId={myUserId}
              isAdminOrPM={isAdminOrPM}
              onTaskClick={onTaskClick}
              onChange={onChange}
              projectFilter={project.id}
              lockProject
              hideProjectPill
            />
          ) : (
            <ProjectInfoTab project={project} canEdit={canEdit} onChange={onChange} />
          )}
        </div>
      </div>
    </div>
  );
}
