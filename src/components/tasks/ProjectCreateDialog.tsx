import { useEffect, useRef, useState } from 'react';
import { C, PROJECT_COLOR_PALETTE, PROJECT_TYPES } from './utils';
import { createProject } from './api';
import type { ProjectType } from './types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function ProjectCreateDialog({ open, ownerId, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLOR_PALETTE[0]);
  const [deadline, setDeadline] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setColor(PROJECT_COLOR_PALETTE[0]);
      setDeadline('');
      setProjectType('');
      setTimeout(() => nameRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const isValid = name.trim() && projectType && deadline;

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        color,
        deadline,
        project_type: projectType as ProjectType,
      }, ownerId);
      toast.success('הפרויקט נוצר ✓');
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error('שגיאה: ' + (e?.message ?? ''));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    background: '#FFFFFF',
    direction: 'rtl' as const,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: C.textSub,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div
        dir="rtl"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, 92vw)',
          background: C.surface,
          borderRadius: 16,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          padding: 24,
          zIndex: 210,
          display: 'flex', flexDirection: 'column', gap: 14,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>פרויקט חדש</h2>

        <div>
          <label style={labelStyle}>שם הפרויקט <span style={{ color: C.red }}>*</span></label>
          <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="לדוגמה: סדנת מנהיגות 2026" />
        </div>

        <div>
          <label style={labelStyle}>סוג פרויקט <span style={{ color: C.red }}>*</span></label>
          <select
            value={projectType}
            onChange={e => setProjectType(e.target.value as ProjectType | '')}
            style={{ ...inputStyle, borderColor: projectType ? C.border : `${C.red}66` }}
          >
            <option value="" disabled>בחר סוג...</option>
            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>דדליין <span style={{ color: C.red }}>*</span></label>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ ...inputStyle, borderColor: deadline ? C.border : `${C.red}66` }}
          />
        </div>

        <div>
          <label style={labelStyle}>צבע</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROJECT_COLOR_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c,
                  border: color === c ? `3px solid ${C.text}` : '3px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, color: C.textSub, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer' }}>
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid || submitting}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600,
              color: '#FFFFFF',
              background: isValid ? C.accent : '#E5E7EB',
              border: 'none', borderRadius: 6,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'יוצר...' : 'צור'}
          </button>
        </div>
      </div>
    </>
  );
}
