import { useEffect, useState } from 'react';
import { C } from './utils';
import { createProjectLink, deleteProjectLink, fetchProjectLinks, updateProject } from './api';
import type { Project, ProjectLink } from './types';
import { toast } from 'sonner';

interface Props {
  project: Project;
  canEdit: boolean;
  onChange: () => void;
}

export default function ProjectInfoTab({ project, canEdit, onChange }: Props) {
  const [info, setInfo] = useState(project.info_md ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  useEffect(() => { setInfo(project.info_md ?? ''); }, [project.info_md]);

  const loadLinks = async () => {
    setLoadingLinks(true);
    try {
      const data = await fetchProjectLinks(project.id);
      setLinks(data);
    } catch (e: any) {
      toast.error('שגיאה בטעינת קישורים: ' + (e?.message ?? ''));
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => { loadLinks(); }, [project.id]);

  const saveInfo = async () => {
    if (info === (project.info_md ?? '')) return;
    setSavingInfo(true);
    try {
      await updateProject(project.id, { info_md: info || null });
      toast.success('המידע נשמר');
      onChange();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    } finally {
      setSavingInfo(false);
    }
  };

  const addLink = async () => {
    const label = newLabel.trim();
    const url = newUrl.trim();
    if (!label || !url || addingLink) return;
    setAddingLink(true);
    try {
      await createProjectLink(project.id, label, url);
      setNewLabel('');
      setNewUrl('');
      await loadLinks();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    } finally {
      setAddingLink(false);
    }
  };

  const removeLink = async (id: string) => {
    if (!confirm('למחוק את הקישור?')) return;
    try {
      await deleteProjectLink(id);
      await loadLinks();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    background: '#FFFFFF',
    color: C.text,
    direction: 'rtl' as const,
  };

  return (
    <div dir="rtl" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Info */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, marginBottom: 8 }}>תיאור</h3>
        <textarea
          value={info}
          onChange={e => setInfo(e.target.value)}
          placeholder="מידע כללי על הפרויקט, מטרות, הקשר..."
          rows={6}
          disabled={!canEdit}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            outline: 'none',
            background: '#FFFFFF',
            color: C.text,
            resize: 'vertical' as const,
            fontFamily: 'inherit',
            direction: 'rtl' as const,
            lineHeight: 1.5,
          }}
        />
        {canEdit && (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={saveInfo}
              disabled={savingInfo || info === (project.info_md ?? '')}
              style={{
                padding: '6px 16px',
                fontSize: 12, fontWeight: 600,
                color: '#FFFFFF',
                background: info !== (project.info_md ?? '') ? C.accent : '#E5E7EB',
                border: 'none', borderRadius: 6,
                cursor: info !== (project.info_md ?? '') ? 'pointer' : 'not-allowed',
              }}
            >
              {savingInfo ? 'שומר...' : 'שמור תיאור'}
            </button>
          </div>
        )}
      </section>

      {/* Links */}
      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, marginBottom: 12 }}>קישורים</h3>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="תווית"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              style={{ ...inputStyle, flex: '1 1 140px', minWidth: 140 }}
            />
            <input
              type="url"
              placeholder="https://..."
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              style={{ ...inputStyle, flex: '2 1 240px', minWidth: 200, direction: 'ltr' as const }}
            />
            <button
              type="button"
              onClick={addLink}
              disabled={!newLabel.trim() || !newUrl.trim() || addingLink}
              style={{
                padding: '8px 16px',
                fontSize: 12, fontWeight: 600,
                color: '#FFFFFF',
                background: (newLabel.trim() && newUrl.trim()) ? C.accent : '#E5E7EB',
                border: 'none', borderRadius: 6,
                cursor: (newLabel.trim() && newUrl.trim()) ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              + הוסף
            </button>
          </div>
        )}

        {loadingLinks ? (
          <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', padding: 12 }}>טוען...</div>
        ) : links.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textSub, textAlign: 'center', padding: 16 }}>אין קישורים</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {links.map(l => (
              <li
                key={l.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px',
                  background: '#F8F9FB',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 100 }}>{l.label}</span>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: C.accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' as const, textAlign: 'left' as const }}
                >
                  {l.url}
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeLink(l.id)}
                    style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 4 }}
                    title="מחק"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
