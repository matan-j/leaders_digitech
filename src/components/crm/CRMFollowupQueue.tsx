import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Followup {
  id: string;
  institution_id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  assigned_to: string;
  task: string;
  next_step: string | null;
  due_date: string;
  status: 'pending' | 'done';
  created_at: string;
  institution: { id: string; name: string } | null;
  contact: { name: string } | null;
  assignee: { full_name: string } | null;
}

interface AssigneeOption {
  id: string;
  full_name: string;
}

interface InstitutionOption {
  id: string;
  name: string;
}

type Group = 'overdue' | 'today' | 'soon';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#F8F9FB', surface: '#FFFFFF', border: '#E4E7ED', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classify(dueDate: string): Group {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'soon';
}

function daysLabel(dueDate: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  if (diff < 0) return `${Math.abs(diff)} ימים באיחור`;
  return `בעוד ${diff} ימים`;
}

function Av({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: C.accentBg, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.8, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ─── Add Followup Modal ───────────────────────────────────────────────────────

function AddFollowupModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (f: Followup) => void;
}) {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [task, setTask] = useState('');
  const [assignedTo, setAssignedTo] = useState(user?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [instSearch, setInstSearch] = useState('');

  useEffect(() => {
    supabase.from('educational_institutions').select('id, name').order('name').then(({ data }) => {
      setInstitutions((data ?? []) as InstitutionOption[]);
    });
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => {
      setAssignees((data ?? []) as AssigneeOption[]);
    });
  }, []);

  const filtered = institutions.filter(i => i.name.includes(instSearch));

  const handleSave = async () => {
    if (!institutionId || !task || !assignedTo || !dueDate) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('crm_followups')
      .insert([{ institution_id: institutionId, task, assigned_to: assignedTo, due_date: dueDate, next_step: nextStep || null, status: 'pending' }])
      .select(`*, institution:institution_id(id, name), contact:contact_id(name), assignee:assigned_to(full_name)`)
      .single();
    setSaving(false);
    if (!error && data) onSaved(data as unknown as Followup);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 12, width: 480, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>+ הוסף פעולת מעקב</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Institution search */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>מוסד</div>
            <input
              value={instSearch}
              onChange={e => { setInstSearch(e.target.value); setInstitutionId(''); }}
              placeholder="חפש מוסד..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none', marginBottom: 4 }}
            />
            {instSearch && !institutionId && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, maxHeight: 140, overflowY: 'auto' }}>
                {filtered.slice(0, 8).map(i => (
                  <div key={i.id} onClick={() => { setInstitutionId(i.id); setInstSearch(i.name); }} style={{ padding: '7px 11px', fontSize: 13, cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = C.bg)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    {i.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>משימה</div>
            <input value={task} onChange={e => setTask(e.target.value)} placeholder="תאר את הפעולה הנדרשת..." style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none' }} />
          </div>

          {/* Assigned to */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>אחראי</div>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none', background: C.surface }}>
              <option value="">בחר אחראי</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>

          {/* Due date */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>תאריך יעד</div>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none' }} />
          </div>

          {/* Next step */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>צעד הבא (אופציונלי)</div>
            <input value={nextStep} onChange={e => setNextStep(e.target.value)} placeholder="מה יקרה אחרי שמסיימים זאת?" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none' }} />
          </div>
        </div>
        <div style={{ padding: '13px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving || !institutionId || !task || !assignedTo || !dueDate}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: (!institutionId || !task || !assignedTo || !dueDate) ? 0.5 : 1 }}
          >
            {saving ? 'שומר...' : '+ הוסף מעקב'}
          </button>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: C.text }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group section ────────────────────────────────────────────────────────────

const GROUP_META: Record<Group, { label: string; color: string; bg: string }> = {
  overdue: { label: '🔴 באיחור', color: C.danger, bg: C.dangerBg },
  today:   { label: '🟡 היום',   color: C.warning, bg: C.warningBg },
  soon:    { label: '🟢 בקרוב',  color: C.success, bg: C.successBg },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMFollowupQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_followups')
      .select(`*, institution:institution_id(id, name), contact:contact_id(name), assignee:assigned_to(full_name)`)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });
    setFollowups((data ?? []) as unknown as Followup[]);

    const { data: profiles } = await supabase.from('profiles').select('id, full_name').order('full_name');
    setAssignees((profiles ?? []) as AssigneeOption[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markDone = async (id: string) => {
    await supabase.from('crm_followups').update({ status: 'done' }).eq('id', id);
    setFollowups(prev => prev.filter(f => f.id !== id));
  };

  const filtered = followups.filter(f => {
    if (filterAssignee && f.assigned_to !== filterAssignee) return false;
    return true;
  });

  const overdueCount = filtered.filter(f => classify(f.due_date) === 'overdue').length;

  const groups: Group[] = ['overdue', 'today', 'soon'];

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto', minHeight: '100%' }}>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.dangerBg, border: `1px solid ${C.danger}20`, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: C.danger, flex: 1 }}>
            ⚠️ <b>{overdueCount} פעולות מעקב באיחור</b>
          </span>
        </div>
      )}

      {/* Filters + add button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          style={{ padding: '7px 12px', border: `1px solid ${filterAssignee ? C.accent : C.border}`, borderRadius: 6, fontSize: 13, background: filterAssignee ? C.accentBg : C.surface, color: filterAssignee ? C.accent : C.textSub, outline: 'none', fontWeight: filterAssignee ? 600 : 400 }}
        >
          <option value="">כל האחראים</option>
          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>

        {filterAssignee && (
          <button
            onClick={() => setFilterAssignee('')}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.danger}30`, background: C.dangerBg, color: C.danger, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
          >
            ✕ נקה
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + הוסף מעקב
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>טוען...</div>
      ) : (
        groups.map(group => {
          const items = filtered.filter(f => classify(f.due_date) === group);
          if (items.length === 0) return null;
          const meta = GROUP_META[group];
          return (
            <div key={group} style={{ marginBottom: 22 }}>
              <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 6, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, marginBottom: 9 }}>
                {meta.label} ({items.length})
              </div>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <Av name={item.institution?.name ?? '?'} size={30} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{item.institution?.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: C.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.task}{item.contact ? ` · ${item.contact.name}` : ''}
                    </div>
                  </div>

                  {item.next_step && (
                    <div style={{ fontSize: 11, color: C.textSub, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ⏭ {item.next_step}
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, minWidth: 80, textAlign: 'right' }}>
                    {daysLabel(item.due_date)}
                  </div>

                  <button
                    onClick={() => markDone(item.id)}
                    style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, fontSize: 11, cursor: 'pointer', color: C.textSub, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    ✓ סיים
                  </button>

                  <button
                    onClick={() => item.institution && navigate(`/crm/institution/${item.institution.id}`)}
                    style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: C.accent, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    פתח →
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          אין פעולות מעקב פתוחות
        </div>
      )}

      {showAdd && (
        <AddFollowupModal
          onClose={() => setShowAdd(false)}
          onSaved={f => { setFollowups(prev => [...prev, f]); setShowAdd(false); }}
        />
      )}
    </div>
  );
}
