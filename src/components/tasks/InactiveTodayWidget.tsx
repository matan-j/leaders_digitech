import { useEffect, useState } from 'react';
import { C } from './utils';
import { fetchAllRecentComments, fetchInactiveUsersToday } from './api';
import type { InactiveUser, ProfileLite, Project, Task } from './types';

interface Props {
  profiles: ProfileLite[];
  tasks: Task[];
  projects: Project[];
  members: { project_id: string; user_id: string }[];
  onUserClick: (userId: string) => void;
}

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
};

const formatAgo = (iso: string | null) => {
  if (!iso) return 'מעולם לא';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `לפני ${Math.max(1, diff)} דק׳`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
};

export default function InactiveTodayWidget({ profiles, tasks, projects, members, onUserClick }: Props) {
  const [users, setUsers] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const comments = await fetchAllRecentComments();
        if (!active) return;
        const list = await fetchInactiveUsersToday({ profiles, tasks, members, projects, comments });
        if (!active) return;
        setUsers(list);
      } catch {
        // silent — widget shouldn't break the page
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profiles, tasks, projects, members]);

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
    }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: C.text, margin: 0, marginBottom: 12 }}>
        <span aria-hidden>🔔</span>
        לא עדכנו היום
        {users.length > 0 && (
          <span style={{
            padding: '2px 10px',
            fontSize: 11, fontWeight: 700,
            color: '#FFFFFF', background: C.red,
            borderRadius: 999,
          }}>
            {users.length}
          </span>
        )}
      </h2>

      {loading ? (
        <div style={{ fontSize: 12, color: C.textSub, padding: 8 }}>טוען...</div>
      ) : users.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.green, fontWeight: 600 }}>
          <span aria-hidden>✓</span>
          כולם עדכנו היום
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {users.map(u => {
            const lastIso = u.last_task_update ?? u.last_comment ?? null;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onUserClick(u.id)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: '#FFFFFF',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'right' as const,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8F9FB'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, color: C.textSub, flexShrink: 0,
                  }}>
                    {initials(u.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {u.full_name || u.email || 'ללא שם'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textSub }}>
                      פעילות אחרונה: {formatAgo(lastIso)}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: C.accent }}>←</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
