import { useEffect, useState } from 'react';
import { C } from './utils';
import { createTaskComment, deleteTaskComment, fetchTaskComments } from './api';
import type { ProfileLite, TaskComment } from './types';
import { toast } from 'sonner';

interface Props {
  taskId: string;
  currentUserId: string;
  isAdminOrPM: boolean;
  profiles: ProfileLite[];
  onActivity?: () => void;
}

const initials = (name: string | null | undefined) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
};

const formatAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return `לפני ${diff} דק׳`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  return `לפני ${Math.floor(h / 24)} ימים`;
};

export default function TaskComments({ taskId, currentUserId, isAdminOrPM, profiles, onActivity }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTaskComments(taskId);
      setComments(data);
    } catch (e: any) {
      toast.error('שגיאה בטעינת תגובות: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [taskId]);

  const submit = async () => {
    const t = body.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      await createTaskComment(taskId, currentUserId, t);
      setBody('');
      await load();
      onActivity?.();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('למחוק את התגובה?')) return;
    try {
      await deleteTaskComment(id);
      await load();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: C.textSub, margin: 0, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        עדכונים ותגובות
      </h3>

      {/* Composer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={onKey}
          placeholder="הוסף עדכון..."
          rows={2}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            background: '#FFFFFF',
            direction: 'rtl' as const,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: C.textSub }}>Cmd/Ctrl + Enter לשליחה</span>
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim() || submitting}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: body.trim() ? '#FFFFFF' : C.textSub,
              background: body.trim() ? C.accent : '#E5E7EB',
              border: 'none',
              borderRadius: 6,
              cursor: body.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'מפרסם...' : 'פרסם'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', padding: 12 }}>טוען...</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', padding: 12 }}>אין עדכונים עדיין</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.map(c => {
            const author = c.author_id ? profileMap.get(c.author_id) : null;
            const canDelete = c.author_id === currentUserId || isAdminOrPM;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex', gap: 8,
                  padding: 10,
                  background: '#F8F9FB',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: C.textSub, flexShrink: 0,
                }}>
                  {initials(author?.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                      {author?.full_name || author?.email || 'לא ידוע'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: C.textSub }}>{formatAgo(c.created_at)}</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.red, padding: 0 }}
                          title="מחק"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.text, whiteSpace: 'pre-wrap' as const, lineHeight: 1.4 }}>
                    {c.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
