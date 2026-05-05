import { useMemo } from 'react';
import { C } from './utils';
import type { ProfileLite, ProjectWithStats, Task } from './types';

interface Props {
  projects: ProjectWithStats[];
  tasks: Task[];
  profiles: ProfileLite[];
  onProjectClick: (id: string) => void;
  onAssigneeClick: (assigneeId: string) => void;
}

interface Insight {
  text: string;
  emphasis: string;
  onClick: () => void;
}

export default function RecommendedAction({ projects, tasks, profiles, onProjectClick, onAssigneeClick }: Props) {
  const insights = useMemo<Insight[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: Insight[] = [];

    // Rule 1: overdue projects
    const overdueProjects = projects.filter(p => {
      if (!p.deadline) return false;
      return new Date(p.deadline + 'T00:00:00').getTime() < today.getTime() && p.status !== 'done';
    });
    if (overdueProjects.length > 0) {
      result.push({
        text: `${overdueProjects.length} ${overdueProjects.length === 1 ? 'פרויקט' : 'פרויקטים'} באיחור — `,
        emphasis: 'לבדוק עכשיו ←',
        onClick: () => onProjectClick(overdueProjects[0].id),
      });
    }

    // Rule 2: closest deadline (≤14 days, positive)
    const upcoming = projects
      .filter(p => p.deadline && p.status !== 'done')
      .map(p => ({
        p,
        days: Math.round((new Date(p.deadline! + 'T00:00:00').getTime() - today.getTime()) / 86400000),
      }))
      .filter(x => x.days >= 0 && x.days <= 14)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length > 0) {
      const top = upcoming[0];
      result.push({
        text: `פרויקט "${top.p.name}" הכי קרוב לדדליין — `,
        emphasis: 'להתמקד כאן ←',
        onClick: () => onProjectClick(top.p.id),
      });
    }

    // Rule 3: assignee with most overdue tasks (>3)
    const overdueByAssignee = new Map<string, number>();
    tasks.forEach(t => {
      if (!t.assignee_id || t.status === 'done' || !t.due_date) return;
      if (new Date(t.due_date + 'T00:00:00').getTime() < today.getTime()) {
        overdueByAssignee.set(t.assignee_id, (overdueByAssignee.get(t.assignee_id) ?? 0) + 1);
      }
    });
    let topAssignee: { id: string; count: number } | null = null;
    overdueByAssignee.forEach((count, id) => {
      if (count > 3 && (!topAssignee || count > topAssignee.count)) {
        topAssignee = { id, count };
      }
    });
    if (topAssignee) {
      const profile = profiles.find(p => p.id === topAssignee!.id);
      const name = profile?.full_name || profile?.email || 'חבר צוות';
      result.push({
        text: `ל${name} יש ${topAssignee.count} משימות באיחור — `,
        emphasis: 'שיחת סטטוס ←',
        onClick: () => onAssigneeClick(topAssignee!.id),
      });
    }

    return result.slice(0, 3);
  }, [projects, tasks, profiles, onProjectClick, onAssigneeClick]);

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
    }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, marginBottom: 10 }}>
        מה הצעד הבא שלך
      </h2>
      {insights.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textSub }}>הכל בשליטה — אין פעולות דחופות 👌</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {insights.map((ins, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: C.text }}>
              <span style={{ color: C.textSub, marginTop: 2 }}>•</span>
              <span>
                {ins.text}
                <button
                  type="button"
                  onClick={ins.onClick}
                  style={{
                    color: C.accent,
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 13,
                  }}
                >
                  {ins.emphasis}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
