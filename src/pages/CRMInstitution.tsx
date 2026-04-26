import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { callCrmAI } from '@/hooks/useCrmAI';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ── design tokens ─────────────────────────────────────────────
const C = {
  bg: '#F8F9FB', surface: '#FFFFFF', border: '#E4E7ED', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  teal: '#0891B2', tealBg: '#CFFAFE',
  ai: '#0EA5E9', aiBg: '#E0F2FE',
  orange: '#EA580C', orangeBg: '#FFEDD5',
};

// ── types ─────────────────────────────────────────────────────
interface Institution {
  id: string; name: string; city: string | null; address: string | null;
  crm_class: string | null; crm_stage: string | null; crm_risk: string | null;
  crm_owner_id: string | null; crm_assigned_instructor_id: string | null;
  crm_lead_source: string | null; crm_potential: number | null;
  crm_ai_score: number | null; crm_last_contact_at: string | null;
  crm_next_step: string | null; crm_next_step_date: string | null;
  crm_interests: string[] | null; crm_pain_points: string | null;
  crm_budget: string | null; crm_notes: string | null; crm_network: string | null;
  instructor: { id: string; full_name: string } | null;
  owner: { id: string; full_name: string } | null;
}
interface Contact {
  id: string; institution_id: string; name: string; phone: string | null;
  email: string | null; role: string | null; is_primary: boolean | null;
  notes: string | null; contact_type?: string | null; created_at: string; updated_at: string;
}
interface Opportunity {
  id: string; institution_id: string; name: string; course_id: string | null;
  stage: string; status: string; contact_id: string | null; value: number | null;
  probability: number | null; proposal_sent: boolean | null; proposal_link: string | null;
  groups: number | null; sessions: number | null; decision_date: string | null;
  loss_reason: string | null; next_step: string | null; next_step_date: string | null;
  created_at: string; updated_at: string;
}
interface Activity {
  id: string; institution_id: string; opportunity_id: string | null;
  contact_id: string | null; user_id: string; type: string;
  summary: string | null; outcome: string | null; next_step: string | null;
  next_step_date: string | null; status: string; occurred_at: string; created_at: string;
}
interface AIResult {
  score: string; closingChance: string; nextStep: string;
  risks: string; opportunities: string;
}
interface CrmFile {
  name: string; size: number; created_at: string; path: string;
}

// ── shared mini-components ────────────────────────────────────
const Av = ({ name, size = 32, color = C.accent, bg = C.accentBg }: { name: string; size?: number; color?: string; bg?: string }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.6, fontWeight: 700, flexShrink: 0 }}>
    {(name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

const Badge = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }}>
    {label}
  </span>
);

const classBadge = (c: string | null) => {
  if (!c) return null;
  const m: Record<string, [string, string]> = { Lead: [C.warning, C.warningBg], Customer: [C.success, C.successBg], 'Past Customer': [C.textSub, C.bg] };
  const [col, bg] = m[c] ?? [C.textSub, C.bg];
  return <Badge label={c} color={col} bg={bg} />;
};

const stageBadge = (s: string | null) => {
  if (!s) return null;
  const m: Record<string, [string, string]> = { 'יצירת קשר': [C.textSub, C.bg], 'מעוניין': [C.accent, C.accentBg], 'סגירה': [C.warning, C.warningBg], 'זכה': [C.success, C.successBg], 'הפסיד': [C.danger, C.dangerBg] };
  const [col, bg] = m[s] ?? [C.textSub, C.bg];
  return <Badge label={s} color={col} bg={bg} />;
};

const riskBadge = (r: string | null) => {
  if (!r) return null;
  const m: Record<string, [string, string]> = { low: [C.success, C.successBg], medium: [C.warning, C.warningBg], high: [C.danger, C.dangerBg] };
  const [col, bg] = m[r] ?? [C.textSub, C.bg];
  return <Badge label={r} color={col} bg={bg} />;
};

const Btn = ({ children, variant = 'primary', sm, onClick, disabled, style = {} }: { children: React.ReactNode; variant?: string; sm?: boolean; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) => {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', fontSize: sm ? 12 : 13, padding: sm ? '5px 11px' : '7px 14px', lineHeight: 1.4, flexShrink: 0, opacity: disabled ? 0.45 : 1 };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: C.accent, color: '#fff' },
    secondary: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: 'transparent', color: C.textSub, border: `1px solid ${C.border}` },
    teal: { background: C.tealBg, color: C.teal, border: `1px solid ${C.teal}30` },
    ai: { background: C.aiBg, color: C.ai, border: `1px solid ${C.ai}30` },
    danger: { background: C.dangerBg, color: C.danger },
  };
  return <button style={{ ...base, ...(variants[variant] ?? variants.primary), ...style }} onClick={disabled ? undefined : onClick}>{children}</button>;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatLastContact = (iso: string | null) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  return `${diff} ימים`;
};

// ── KPI mini card ─────────────────────────────────────────────
const KpiCard = ({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) => (
  <div style={{ flex: 1, padding: '7px 11px', borderRadius: 7, background: bg, border: `1px solid ${color}20` }}>
    <div style={{ fontSize: 9, color, fontWeight: 500, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
  </div>
);

// ── MODALS ────────────────────────────────────────────────────
const ModalShell = ({ title, width = 500, onClose, children, footer }: { title: string; width?: number; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: C.surface, borderRadius: 12, width, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>{children}</div>
      {footer && <div style={{ padding: '13px 22px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', gap: 8 }}>{footer}</div>}
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none', background: C.surface };
const selectStyle: React.CSSProperties = { ...inputStyle };

// AddContact Modal
interface AddContactModalProps { institutionId: string; onClose: () => void; onSaved: (c: Contact) => void; }
const CONTACT_TYPES = ['מנהל', 'מנהל פדגוגי', 'אחראי פדגוגי', 'הנהלת חשבונות', 'אחר'];

const AddContactModal = ({ institutionId, onClose, onSaved }: AddContactModalProps) => {
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '', notes: '', is_primary: false, contact_type: 'אחר' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('crm_contacts').insert([{ institution_id: institutionId, name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null, notes: form.notes || null, is_primary: form.is_primary, contact_type: form.contact_type }]).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Contact);
  };

  return (
    <ModalShell title="+ איש קשר חדש" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={!form.name.trim() || saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="שם *"><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם מלא" /></Field>
      <Field label="סוג איש קשר">
        <select style={selectStyle} value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
          {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="תפקיד"><input style={inputStyle} value={form.role} onChange={e => set('role', e.target.value)} placeholder="מנהל, מנהל חינוך..." /></Field>
      <Field label="טלפון"><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05X-XXXXXXX" /></Field>
      <Field label="אימייל"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@org.il" /></Field>
      <Field label="הערות"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} />
        איש קשר ראשי
      </label>
    </ModalShell>
  );
};

// EditContact Modal
interface EditContactModalProps { contact: Contact; onClose: () => void; onSaved: (c: Contact) => void; }
const EditContactModal = ({ contact, onClose, onSaved }: EditContactModalProps) => {
  const [form, setForm] = useState({ name: contact.name, role: contact.role ?? '', phone: contact.phone ?? '', email: contact.email ?? '', notes: contact.notes ?? '', is_primary: contact.is_primary, contact_type: contact.contact_type ?? 'אחר' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('crm_contacts').update({ name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null, notes: form.notes || null, is_primary: form.is_primary, contact_type: form.contact_type, updated_at: new Date().toISOString() }).eq('id', contact.id).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Contact);
  };

  return (
    <ModalShell title="✏️ עריכת איש קשר" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={!form.name.trim() || saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="שם *"><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם מלא" /></Field>
      <Field label="סוג איש קשר">
        <select style={selectStyle} value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
          {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="תפקיד"><input style={inputStyle} value={form.role} onChange={e => set('role', e.target.value)} placeholder="מנהל, מנהל חינוך..." /></Field>
      <Field label="טלפון"><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05X-XXXXXXX" /></Field>
      <Field label="אימייל"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@org.il" /></Field>
      <Field label="הערות"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_primary ?? false} onChange={e => set('is_primary', e.target.checked)} />
        איש קשר ראשי
      </label>
    </ModalShell>
  );
};

// AddOpportunity Modal
const STAGES = ['יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד'];
interface AddOpportunityModalProps { institutionId: string; contacts: Contact[]; onClose: () => void; onSaved: (o: Opportunity) => void; }
const AddOpportunityModal = ({ institutionId, contacts, onClose, onSaved }: AddOpportunityModalProps) => {
  const [form, setForm] = useState({ name: '', stage: 'יצירת קשר', contact_id: '', value: '', decision_date: '', next_step: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('crm_opportunities').insert([{
      institution_id: institutionId, name: form.name, stage: form.stage, status: 'open',
      contact_id: form.contact_id || null,
      value: form.value ? parseFloat(form.value) : null,
      decision_date: form.decision_date || null,
      next_step: form.next_step || null,
    }]).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Opportunity);
  };

  return (
    <ModalShell title="+ הזדמנות חדשה" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={!form.name.trim() || saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="שם הזדמנות *"><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="תוכנית AI לחטיבת ביניים" /></Field>
      <Field label="שלב">
        <select style={selectStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="איש קשר">
        <select style={selectStyle} value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
          <option value="">— בחר —</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="ערך (₪)"><input style={inputStyle} type="number" value={form.value} onChange={e => set('value', e.target.value)} placeholder="50000" /></Field>
      <Field label="תאריך החלטה"><input style={inputStyle} type="date" value={form.decision_date} onChange={e => set('decision_date', e.target.value)} /></Field>
      <Field label="פעולה הבאה"><input style={inputStyle} value={form.next_step} onChange={e => set('next_step', e.target.value)} placeholder="שלח הצעת מחיר" /></Field>
    </ModalShell>
  );
};

// EditOpportunity Modal
interface EditOpportunityModalProps { opportunity: Opportunity; contacts: Contact[]; onClose: () => void; onSaved: (o: Opportunity) => void; }
const EditOpportunityModal = ({ opportunity, contacts, onClose, onSaved }: EditOpportunityModalProps) => {
  const [form, setForm] = useState({
    name: opportunity.name,
    stage: opportunity.stage,
    contact_id: opportunity.contact_id ?? '',
    value: opportunity.value?.toString() ?? '',
    decision_date: opportunity.decision_date ?? '',
    next_step: opportunity.next_step ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('crm_opportunities').update({
      name: form.name, stage: form.stage,
      contact_id: form.contact_id || null,
      value: form.value ? parseFloat(form.value) : null,
      decision_date: form.decision_date || null,
      next_step: form.next_step || null,
      updated_at: new Date().toISOString(),
    }).eq('id', opportunity.id).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Opportunity);
  };

  return (
    <ModalShell title="✏️ עריכת הזדמנות" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={!form.name.trim() || saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="שם הזדמנות *"><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="שלב">
        <select style={selectStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="איש קשר">
        <select style={selectStyle} value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
          <option value="">— בחר —</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="ערך (₪)"><input style={inputStyle} type="number" value={form.value} onChange={e => set('value', e.target.value)} /></Field>
      <Field label="תאריך החלטה"><input style={inputStyle} type="date" value={form.decision_date} onChange={e => set('decision_date', e.target.value)} /></Field>
      <Field label="פעולה הבאה"><input style={inputStyle} value={form.next_step} onChange={e => set('next_step', e.target.value)} /></Field>
    </ModalShell>
  );
};

// LogActivity Modal
const ACTIVITY_TYPES = ['שיחה', 'מייל', 'פגישה', 'וואטסאפ', 'אחר'];
interface LogActivityModalProps { institutionId: string; contacts: Contact[]; opportunities: Opportunity[]; onClose: () => void; onSaved: (a: Activity) => void; }
const LogActivityModal = ({ institutionId, contacts, opportunities, onClose, onSaved }: LogActivityModalProps) => {
  const [form, setForm] = useState({ type: 'שיחה', contact_id: '', opportunity_id: '', summary: '', outcome: '', next_step: '', occurred_at: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('crm_activities').insert([{
      institution_id: institutionId, type: form.type, user_id: user!.id,
      contact_id: form.contact_id || null, opportunity_id: form.opportunity_id || null,
      summary: form.summary || null, outcome: form.outcome || null, next_step: form.next_step || null,
      occurred_at: form.occurred_at, status: 'Completed',
    }]).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Activity);
  };

  return (
    <ModalShell title="תעד פעילות" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="סוג">
        <select style={selectStyle} value={form.type} onChange={e => set('type', e.target.value)}>
          {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="תאריך"><input style={inputStyle} type="date" value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} /></Field>
      <Field label="איש קשר">
        <select style={selectStyle} value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
          <option value="">— בחר —</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="הזדמנות">
        <select style={selectStyle} value={form.opportunity_id} onChange={e => set('opportunity_id', e.target.value)}>
          <option value="">— בחר —</option>
          {opportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="סיכום"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="מה דיברנו..." /></Field>
      <Field label="תוצאה"><input style={inputStyle} value={form.outcome} onChange={e => set('outcome', e.target.value)} placeholder="מה הוסכם..." /></Field>
      <Field label="פעולה הבאה"><input style={inputStyle} value={form.next_step} onChange={e => set('next_step', e.target.value)} placeholder="מה עושים אחר כך..." /></Field>
    </ModalShell>
  );
};

// EditActivity Modal
interface EditActivityModalProps { activity: Activity; contacts: Contact[]; opportunities: Opportunity[]; onClose: () => void; onSaved: (a: Activity) => void; }
const EditActivityModal = ({ activity, contacts, opportunities, onClose, onSaved }: EditActivityModalProps) => {
  const [form, setForm] = useState({
    type: activity.type,
    contact_id: activity.contact_id ?? '',
    opportunity_id: activity.opportunity_id ?? '',
    summary: activity.summary ?? '',
    outcome: activity.outcome ?? '',
    next_step: activity.next_step ?? '',
    occurred_at: activity.occurred_at.slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('crm_activities').update({
      type: form.type,
      contact_id: form.contact_id || null,
      opportunity_id: form.opportunity_id || null,
      summary: form.summary || null,
      outcome: form.outcome || null,
      next_step: form.next_step || null,
      occurred_at: form.occurred_at,
    }).eq('id', activity.id).select().single();
    setSaving(false);
    if (!error && data) onSaved(data as Activity);
  };

  return (
    <ModalShell title="✏️ עריכת פעילות" onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <Field label="סוג">
        <select style={selectStyle} value={form.type} onChange={e => set('type', e.target.value)}>
          {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="תאריך"><input style={inputStyle} type="date" value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} /></Field>
      <Field label="איש קשר">
        <select style={selectStyle} value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
          <option value="">— בחר —</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="הזדמנות">
        <select style={selectStyle} value={form.opportunity_id} onChange={e => set('opportunity_id', e.target.value)}>
          <option value="">— בחר —</option>
          {opportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="סיכום"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={form.summary} onChange={e => set('summary', e.target.value)} /></Field>
      <Field label="תוצאה"><input style={inputStyle} value={form.outcome} onChange={e => set('outcome', e.target.value)} /></Field>
      <Field label="פעולה הבאה"><input style={inputStyle} value={form.next_step} onChange={e => set('next_step', e.target.value)} /></Field>
    </ModalShell>
  );
};

// EditInstitution Modal
interface EditInstitutionModalProps { institution: Institution; onClose: () => void; onSaved: (updated: Partial<Institution>) => void; }
const EditInstitutionModal = ({ institution, onClose, onSaved }: EditInstitutionModalProps) => {
  const [form, setForm] = useState({
    crm_class: institution.crm_class ?? '',
    crm_stage: institution.crm_stage ?? '',
    crm_risk: institution.crm_risk ?? '',
    crm_network: institution.crm_network ?? '',
    crm_budget: institution.crm_budget ?? '',
    crm_potential: institution.crm_potential?.toString() ?? '',
    crm_next_step: institution.crm_next_step ?? '',
    crm_next_step_date: institution.crm_next_step_date ?? '',
    crm_pain_points: institution.crm_pain_points ?? '',
    crm_notes: institution.crm_notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const patch = {
      crm_class: form.crm_class || null,
      crm_stage: form.crm_stage || null,
      crm_risk: form.crm_risk || null,
      crm_network: form.crm_network || null,
      crm_budget: form.crm_budget || null,
      crm_potential: form.crm_potential ? parseFloat(form.crm_potential) : null,
      crm_next_step: form.crm_next_step || null,
      crm_next_step_date: form.crm_next_step_date || null,
      crm_pain_points: form.crm_pain_points || null,
      crm_notes: form.crm_notes || null,
    };
    const { error } = await supabase.from('educational_institutions').update(patch).eq('id', institution.id);
    setSaving(false);
    if (!error) {
      onSaved(patch);
      if (form.crm_stage && form.crm_stage !== institution.crm_stage) {
        supabase.functions.invoke('crm-automation-trigger', {
          body: { institution_id: institution.id, new_stage: form.crm_stage, old_stage: institution.crm_stage ?? null },
        }).catch(() => { /* fire-and-forget */ });
      }
    }
  };

  return (
    <ModalShell title={`✏️ עריכה — ${institution.name}`} width={560} onClose={onClose} footer={<><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={saving} onClick={save}>{saving ? 'שומר...' : '✓ שמור שינויים'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="סיווג">
          <select style={selectStyle} value={form.crm_class} onChange={e => set('crm_class', e.target.value)}>
            <option value="">— בחר —</option>
            {['Lead', 'Customer', 'Past Customer'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="שלב">
          <select style={selectStyle} value={form.crm_stage} onChange={e => set('crm_stage', e.target.value)}>
            <option value="">— בחר —</option>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="סיכון">
          <select style={selectStyle} value={form.crm_risk} onChange={e => set('crm_risk', e.target.value)}>
            <option value="">— בחר —</option>
            {['low', 'medium', 'high'].map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="פוטנציאל (₪)"><input style={inputStyle} type="number" value={form.crm_potential} onChange={e => set('crm_potential', e.target.value)} /></Field>
        <Field label="רשת חינוכית"><input style={inputStyle} value={form.crm_network} onChange={e => set('crm_network', e.target.value)} /></Field>
        <Field label="תקציב"><input style={inputStyle} value={form.crm_budget} onChange={e => set('crm_budget', e.target.value)} /></Field>
        <Field label="פעולה הבאה"><input style={inputStyle} value={form.crm_next_step} onChange={e => set('crm_next_step', e.target.value)} /></Field>
        <Field label="תאריך פעולה הבאה"><input style={inputStyle} type="date" value={form.crm_next_step_date} onChange={e => set('crm_next_step_date', e.target.value)} /></Field>
      </div>
      <Field label="נקודות כאב"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={form.crm_pain_points} onChange={e => set('crm_pain_points', e.target.value)} /></Field>
      <Field label="הערות CRM"><textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={form.crm_notes} onChange={e => set('crm_notes', e.target.value)} /></Field>
    </ModalShell>
  );
};

// ── tab: סקירה ────────────────────────────────────────────────
const TabOverview = ({ institution, activities, contacts, onNotesSaved }: { institution: Institution; activities: Activity[]; contacts: Contact[]; onNotesSaved: (notes: string) => void }) => {
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c.name]));
  const typeIcon: Record<string, string> = { שיחה: '📞', מייל: '📧', פגישה: '🤝', וואטסאפ: '📱', אחר: '📝' };
  const [notes, setNotes] = useState(institution.crm_notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleNotesBlur = async () => {
    if (notes === (institution.crm_notes ?? '')) return;
    setSaving(true);
    await supabase.from('educational_institutions').update({ crm_notes: notes || null }).eq('id', institution.id);
    setSaving(false);
    onNotesSaved(notes);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>מידע מסחרי</div>
        {[
          ['תחומי עניין', (institution.crm_interests ?? []).join(', ') || '—'],
          ['נקודות כאב', institution.crm_pain_points ?? '—'],
          ['תקציב', institution.crm_budget ?? '—'],
          ['רשת חינוכית', institution.crm_network ?? '—'],
          ['מקור ליד', institution.crm_lead_source ?? '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.borderLight}` }}>
            <span style={{ width: 120, fontSize: 12, color: C.textSub, fontWeight: 500, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 12, color: C.text }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            הערות
            {saving && <span style={{ fontSize: 9, color: C.textDim, fontWeight: 400 }}>שומר...</span>}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="הוסף הערות על המוסד..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text, background: C.bg, resize: 'vertical', minHeight: 80, outline: 'none', lineHeight: 1.6, fontFamily: 'inherit' }}
          />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>פעילות אחרונה</div>
        {activities.slice(0, 3).length === 0 ? (
          <div style={{ fontSize: 13, color: C.textDim }}>אין פעילות עדיין</div>
        ) : activities.slice(0, 3).map(a => (
          <div key={a.id} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, background: C.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{typeIcon[a.type] ?? '📝'}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{a.type}</span>
              <span style={{ fontSize: 11, color: C.textDim, marginRight: 'auto' }}>{formatDate(a.occurred_at)}</span>
              {a.contact_id && <span style={{ fontSize: 11, color: C.textSub }}>👤 {contactMap[a.contact_id] ?? '—'}</span>}
            </div>
            {a.summary && <div style={{ fontSize: 12, color: C.text }}>{a.summary}</div>}
            {a.outcome && <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>↳ {a.outcome}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── tab: אנשי קשר ─────────────────────────────────────────────
const TabContacts = ({ contacts, onAdd, onEdit, onDelete }: { contacts: Contact[]; onAdd: () => void; onEdit: (c: Contact) => void; onDelete: (id: string) => void }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{contacts.length} אנשי קשר</span>
      <Btn sm onClick={onAdd}>+ הוסף</Btn>
    </div>
    {contacts.length === 0 ? (
      <div style={{ padding: '32px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>אין אנשי קשר עדיין</div>
    ) : (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {['שם', 'תפקיד', 'טלפון', 'אימייל', 'דגלים', 'פעולות'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Av name={c.name} size={28} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }}>{c.role ?? '—'}</td>
                <td style={{ padding: '9px 12px', fontSize: 12 }}>{c.phone ?? '—'}</td>
                <td style={{ padding: '9px 12px', fontSize: 12 }}>{c.email ?? '—'}</td>
                <td style={{ padding: '9px 12px' }}>
                  {c.is_primary && <Badge label="ראשי" color={C.accent} bg={C.accentBg} />}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" sm onClick={() => onEdit(c)}>✏️</Btn>
                    <Btn variant="danger" sm onClick={() => {
                      if (window.confirm(`למחוק את ${c.name}?`)) onDelete(c.id);
                    }}>🗑️</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ── tab: הזדמנויות ────────────────────────────────────────────
const TabOpportunities = ({ opportunities, contacts, onAdd, onEdit, onDelete }: { opportunities: Opportunity[]; contacts: Contact[]; onAdd: () => void; onEdit: (o: Opportunity) => void; onDelete: (id: string) => void }) => {
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c.name]));
  const STAGE_COLORS: Record<string, [string, string]> = { 'יצירת קשר': [C.textSub, C.bg], 'מעוניין': [C.accent, C.accentBg], 'סגירה': [C.warning, C.warningBg], 'זכה': [C.success, C.successBg], 'הפסיד': [C.danger, C.dangerBg] };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{opportunities.length} הזדמנויות</span>
        <Btn sm onClick={onAdd}>+ הוסף הזדמנות</Btn>
      </div>
      {opportunities.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>אין הזדמנויות עדיין</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opportunities.map(o => {
            const [sc, sbg] = STAGE_COLORS[o.stage] ?? [C.textSub, C.bg];
            return (
              <div key={o.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 16px', borderRight: `4px solid ${sc}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{o.name}</span>
                  <Badge label={o.stage} color={sc} bg={sbg} />
                  {o.value != null && <span style={{ fontSize: 13, fontWeight: 800, color: C.success }}>₪{Number(o.value).toLocaleString('he-IL')}</span>}
                  <Btn variant="ghost" sm onClick={() => onEdit(o)}>✏️</Btn>
                  <Btn variant="danger" sm onClick={() => {
                    if (window.confirm(`למחוק את "${o.name}"?`)) onDelete(o.id);
                  }}>🗑️</Btn>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.textSub }}>
                  {o.contact_id && <span>👤 {contactMap[o.contact_id] ?? '—'}</span>}
                  {o.decision_date && <span>📅 {formatDate(o.decision_date)}</span>}
                  {o.next_step && <span>⏭ {o.next_step}</span>}
                  {o.probability != null && <span>📊 {o.probability}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── tab: פעילות ───────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = { שיחה: '📞', מייל: '📧', פגישה: '🤝', וואטסאפ: '📱', אחר: '📝' };
const STATUS_COLORS: Record<string, [string, string]> = { Open: [C.warning, C.warningBg], Waiting: [C.accent, C.accentBg], Completed: [C.success, C.successBg] };

const TabActivity = ({ activities, contacts, opportunities, onLog, onEdit, onDelete }: { activities: Activity[]; contacts: Contact[]; opportunities: Opportunity[]; onLog: () => void; onEdit: (a: Activity) => void; onDelete: (id: string) => void }) => {
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c.name]));
  const oppMap = Object.fromEntries(opportunities.map(o => [o.id, o.name]));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{activities.length} פעילויות</span>
        <Btn sm onClick={onLog}>+ תעד פעילות</Btn>
      </div>
      {activities.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>אין פעילות עדיין</div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', right: 19, top: 0, bottom: 0, width: 2, background: C.borderLight }} />
          {activities.map(a => {
            const [sc, sbg] = STATUS_COLORS[a.status] ?? [C.textSub, C.bg];
            return (
              <div key={a.id} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.surface, border: `2px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                  {TYPE_ICON[a.type] ?? '📝'}
                </div>
                <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{a.type}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{formatDate(a.occurred_at)}</span>
                    {a.contact_id && <span style={{ fontSize: 11, color: C.textSub }}>👤 {contactMap[a.contact_id] ?? '—'}</span>}
                    {a.opportunity_id && <span style={{ fontSize: 11, color: C.textSub }}>🎯 {oppMap[a.opportunity_id] ?? '—'}</span>}
                    <Badge label={a.status} color={sc} bg={sbg} />
                    <div style={{ marginRight: 'auto', display: 'flex', gap: 4 }}>
                      <Btn variant="ghost" sm onClick={() => onEdit(a)}>✏️</Btn>
                      <Btn variant="danger" sm onClick={() => {
                        if (window.confirm('למחוק פעילות זו?')) onDelete(a.id);
                      }}>🗑️</Btn>
                    </div>
                  </div>
                  {a.summary && <div style={{ fontSize: 12, color: C.text, marginBottom: 3 }}>{a.summary}</div>}
                  {a.outcome && <div style={{ fontSize: 11, color: C.textSub }}>↳ {a.outcome}</div>}
                  {a.next_step && <div style={{ fontSize: 11, color: C.accent, marginTop: 4 }}>⏭ {a.next_step}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── tab: תקשורת ───────────────────────────────────────────────
const TabCommunication = ({ activities, contacts, onWhatsApp, onEmail }: { activities: Activity[]; contacts: Contact[]; onWhatsApp: () => void; onEmail: () => void }) => {
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c.name]));
  const msgs = activities.filter(a => a.type === 'מייל' || a.type === 'וואטסאפ');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{msgs.length} הודעות</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="teal" sm onClick={onWhatsApp}>📱 וואטסאפ</Btn>
          <Btn variant="ghost" sm onClick={onEmail}>📧 מייל</Btn>
        </div>
      </div>
      {msgs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
          אין תקשורת עדיין — שלח מייל או וואטסאפ
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.map(a => (
            <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>{a.type === 'מייל' ? '📧' : '📱'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{a.type}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>{formatDate(a.occurred_at)}</span>
                  {a.contact_id && <span style={{ fontSize: 11, color: C.textSub }}>👤 {contactMap[a.contact_id] ?? '—'}</span>}
                </div>
                {a.summary && <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{a.summary}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── tab: קבצים ────────────────────────────────────────────────
const TabFiles = ({ institutionId }: { institutionId: string }) => {
  const [files, setFiles] = useState<CrmFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prefix = `crm/${institutionId}/`;

  const loadFiles = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from('lesson-files').list(`crm/${institutionId}`, { sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      setFiles(data.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
        name: f.name,
        size: f.metadata?.size ?? 0,
        created_at: f.created_at ?? '',
        path: `${prefix}${f.name}`,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [institutionId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    await supabase.storage.from('lesson-files').upload(`${prefix}${safeName}`, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadFiles();
  };

  const deleteFile = async (path: string, name: string) => {
    if (!window.confirm(`למחוק את "${name}"?`)) return;
    await supabase.storage.from('lesson-files').remove([path]);
    setFiles(p => p.filter(f => f.path !== path));
  };

  const getUrl = (path: string) => supabase.storage.from('lesson-files').getPublicUrl(path).data.publicUrl;

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{files.length} קבצים</span>
        <div>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={upload} />
          <Btn sm onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'מעלה...' : '⬆️ העלה קובץ'}
          </Btn>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>טוען...</div>
      ) : files.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📁</div>
          אין קבצים עדיין
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['שם קובץ', 'גודל', 'תאריך', 'הורדה', 'מחיקה'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.path} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: '9px 12px', fontSize: 13 }}>📄 {f.name}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }}>{fmtSize(f.size)}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }}>{formatDate(f.created_at)}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <a href={getUrl(f.path)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>⬇️ הורד</a>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <Btn variant="danger" sm onClick={() => deleteFile(f.path, f.name)}>🗑️</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── tab: AI ───────────────────────────────────────────────────
const TabAI = ({ institution, opportunities, activities }: { institution: Institution; opportunities: Opportunity[]; activities: Activity[] }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const raw = await callCrmAI('institution_analysis', {
        name: institution.name,
        city: institution.city ?? null,
        stage: institution.crm_stage ?? null,
        potential: institution.crm_potential ?? null,
        openOpportunities: opportunities.filter(o => o.status === 'open').length,
        totalActivities: activities.length,
        lastContact: institution.crm_last_contact_at ?? null,
        lastActivities: activities.slice(0, 5).map(a => ({ type: a.type, summary: a.summary, occurred_at: a.occurred_at })),
      });

      let parsed: { score?: string | number; close_probability?: string; next_step?: string; risks?: string[]; opportunities?: string[] };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        setResult({ score: '—', closingChance: '—', nextStep: raw, risks: '—', opportunities: '—' });
        setLoading(false);
        return;
      }

      const riskText = Array.isArray(parsed.risks) ? parsed.risks.join(' | ') : String(parsed.risks ?? '—');
      const oppText = Array.isArray(parsed.opportunities) ? parsed.opportunities.join(' | ') : String(parsed.opportunities ?? '—');
      setResult({
        score: String(parsed.score ?? '—'),
        closingChance: parsed.close_probability ?? '—',
        nextStep: parsed.next_step ?? '—',
        risks: riskText,
        opportunities: oppText,
      });
    } catch {
      setResult({ score: '—', closingChance: '—', nextStep: '—', risks: 'שגיאה בחיבור', opportunities: '—' });
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>ניתוח AI מעמיק של המוסד — ציון, סיכוי סגירה, סיכונים והזדמנויות</div>
          <Btn variant="ai" onClick={run}>✨ הפעל ניתוח</Btn>
        </div>
      )}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.ai, fontSize: 13 }}>⟳ מנתח...</div>
      )}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            ['ציון CRM', result.score, C.ai, C.aiBg, '🏆'],
            ['סיכוי סגירה', result.closingChance, C.success, C.successBg, '📊'],
            ['צעד הבא', result.nextStep, C.accent, C.accentBg, '⏭'],
            ['סיכונים', result.risks, C.danger, C.dangerBg, '⚠️'],
            ['הזדמנויות', result.opportunities, C.purple, C.purpleBg, '✨'],
          ] as [string, string, string, string, string][]).map(([label, value, col, bg, icon]) => (
            <div key={label} style={{ padding: '12px 16px', borderRadius: 9, background: bg, border: `1px solid ${col}20` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: col, marginBottom: 4 }}>{icon} {label}</div>
              <div style={{ fontSize: 13, color: C.text }}>{value}</div>
            </div>
          ))}
          <Btn variant="ai" sm onClick={run} style={{ alignSelf: 'flex-start', marginTop: 4 }}>⟳ רענן ניתוח</Btn>
        </div>
      )}
    </div>
  );
};

// ── helpers ───────────────────────────────────────────────────
async function callGHL(action: string, payload: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('crm-ghl', {
    body: { action, payload },
  });
  if (error) throw error;
  if (data && !data.ok) throw new Error(data.error ?? 'GHL error');
  return data;
}

function replaceVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// SendWhatsApp Modal
interface MessageTemplate { id: string; name: string; channel: string; body: string; subject: string | null; variables: string[] | null }
interface SendWhatsAppModalProps { contacts: Contact[]; institutionName: string; institutionId: string; onClose: () => void; onSent: (a: Activity) => void; }
const SendWhatsAppModal = ({ contacts, institutionName, institutionId, onClose, onSent }: SendWhatsAppModalProps) => {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('crm_message_templates').select('id, name, channel, body, subject, variables').eq('channel', 'whatsapp').then(({ data }) => {
      if (data) setTemplates(data as MessageTemplate[]);
    });
  }, []);

  const selectedContact = contacts.find(c => c.id === contactId);
  const selectedTemplate = templates.find(t => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate && selectedContact) {
      setMessage(replaceVars(selectedTemplate.body, { שם: selectedContact.name, מוסד: institutionName }));
    }
  }, [templateId, contactId, selectedTemplate, selectedContact, institutionName]);

  const preview = selectedContact ? replaceVars(message, { שם: selectedContact.name, מוסד: institutionName }) : message;

  const send = async () => {
    if (!selectedContact?.phone || !message.trim()) return;
    setSending(true); setError('');
    try {
      await callGHL('send_whatsapp', { phone: selectedContact.phone, message: preview, contactName: selectedContact.name });
      const { data: { user } } = await supabase.auth.getUser();
      const { data: act } = await supabase.from('crm_activities').insert([{
        institution_id: institutionId, type: 'וואטסאפ', user_id: user!.id,
        contact_id: contactId || null, summary: preview.slice(0, 200), status: 'Completed',
        occurred_at: new Date().toISOString(),
      }]).select().single();
      if (act) onSent(act as Activity);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell title="📱 שלח וואטסאפ" onClose={onClose} footer={
      <><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={sending || !selectedContact?.phone || !message.trim()} onClick={send}>{sending ? 'שולח...' : '📱 שלח'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn></>
    }>
      <Field label="איש קשר">
        <select style={selectStyle} value={contactId} onChange={e => setContactId(e.target.value)}>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ' (ללא טלפון)'}</option>)}
        </select>
      </Field>
      {!selectedContact?.phone && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>⚠️ לאיש קשר זה אין מספר טלפון</div>}
      <Field label="תבנית (אופציונלי)">
        <select style={selectStyle} value={templateId} onChange={e => setTemplateId(e.target.value)}>
          <option value="">— הודעה מותאמת —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="הודעה">
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} value={message} onChange={e => setMessage(e.target.value)} placeholder="כתוב הודעה..." />
      </Field>
      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#DCF8C6', fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, marginBottom: 4 }}>תצוגה מקדימה</div>
          {preview}
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>❌ {error}</div>}
    </ModalShell>
  );
};

// SendEmail Modal
interface SendEmailModalProps { contacts: Contact[]; institutionName: string; institutionId: string; onClose: () => void; onSent: (a: Activity) => void; }
const SendEmailModal = ({ contacts, institutionName, institutionId, onClose, onSent }: SendEmailModalProps) => {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('crm_message_templates').select('id, name, channel, body, subject, variables').eq('channel', 'email').then(({ data }) => {
      if (data) setTemplates(data as MessageTemplate[]);
    });
  }, []);

  const selectedContact = contacts.find(c => c.id === contactId);
  const selectedTemplate = templates.find(t => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate && selectedContact) {
      const vars = { שם: selectedContact.name, מוסד: institutionName };
      setBody(replaceVars(selectedTemplate.body, vars));
      if (selectedTemplate.subject) setSubject(replaceVars(selectedTemplate.subject, vars));
    }
  }, [templateId, contactId, selectedTemplate, selectedContact, institutionName]);

  const send = async () => {
    console.log('sending email...', { email: selectedContact?.email, bodyLength: body.trim().length });
    if (!selectedContact?.email || !body.trim()) return;
    setSending(true); setError('');
    try {
      console.log('guard passed, calling callGHL...')
      const result = await callGHL('send_email', { email: selectedContact.email, subject: subject || '(ללא נושא)', body, contactName: selectedContact.name });
      console.log('callGHL result:', result)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: act } = await supabase.from('crm_activities').insert([{
        institution_id: institutionId, type: 'מייל', user_id: user!.id,
        contact_id: contactId || null, summary: `${subject ? subject + ': ' : ''}${body.slice(0, 160)}`, status: 'Completed',
        occurred_at: new Date().toISOString(),
      }]).select().single();
      if (act) onSent(act as Activity);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell title="📧 שלח מייל" onClose={onClose} footer={
      <><Btn style={{ flex: 1, justifyContent: 'center' }} disabled={sending || !selectedContact?.email || !body.trim()} onClick={send}>{sending ? 'שולח...' : '📧 שלח'}</Btn><Btn variant="secondary" onClick={onClose}>ביטול</Btn>{!selectedContact?.email && <span style={{ fontSize: 11, color: '#e55', marginTop: 4, display: 'block', textAlign: 'center', width: '100%' }}>לאיש קשר זה אין כתובת מייל</span>}</>
    }>
      <Field label="איש קשר">
        <select style={selectStyle} value={contactId} onChange={e => setContactId(e.target.value)}>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ' (ללא אימייל)'}</option>)}
        </select>
      </Field>
      {!selectedContact?.email && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>⚠️ לאיש קשר זה אין כתובת מייל</div>}
      <Field label="תבנית (אופציונלי)">
        <select style={selectStyle} value={templateId} onChange={e => setTemplateId(e.target.value)}>
          <option value="">— הודעה מותאמת —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="נושא"><input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא המייל" /></Field>
      <Field label="תוכן">
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} value={body} onChange={e => setBody(e.target.value)} placeholder="תוכן המייל..." />
      </Field>
      {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>❌ {error}</div>}
    </ModalShell>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────
const CRMInstitution = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showAddOpportunity, setShowAddOpportunity] = useState(false);
  const [editOpportunity, setEditOpportunity] = useState<Opportunity | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [instRes, contactsRes, oppsRes, actsRes] = await Promise.all([
        supabase.from('educational_institutions').select('*, instructor:crm_assigned_instructor_id(id, full_name), owner:crm_owner_id(id, full_name)').eq('id', id).single(),
        supabase.from('crm_contacts').select('*').eq('institution_id', id).order('is_primary', { ascending: false }),
        supabase.from('crm_opportunities').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('crm_activities').select('*').eq('institution_id', id).order('occurred_at', { ascending: false }),
      ]);
      if (instRes.data) {
        const d = instRes.data as any;
        setInstitution({
          ...d,
          instructor: Array.isArray(d.instructor) ? d.instructor[0] ?? null : d.instructor,
          owner: Array.isArray(d.owner) ? d.owner[0] ?? null : d.owner,
        });
      }
      if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
      if (oppsRes.data) setOpportunities(oppsRes.data as Opportunity[]);
      if (actsRes.data) setActivities(actsRes.data as Activity[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const deleteContact = async (contactId: string) => {
    await supabase.from('crm_contacts').delete().eq('id', contactId);
    setContacts(p => p.filter(c => c.id !== contactId));
  };

  const deleteOpportunity = async (oppId: string) => {
    await supabase.from('crm_opportunities').delete().eq('id', oppId);
    setOpportunities(p => p.filter(o => o.id !== oppId));
  };

  const deleteActivity = async (actId: string) => {
    await supabase.from('crm_activities').delete().eq('id', actId);
    setActivities(p => p.filter(a => a.id !== actId));
  };

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>טוען...</div>
  );

  if (!institution) return (
    <div style={{ padding: '40px', textAlign: 'center', color: C.danger, fontSize: 13 }}>מוסד לא נמצא</div>
  );

  const openOpps = opportunities.filter(o => o.status === 'open').length;
  const totalRevenue = opportunities.filter(o => o.status === 'won').reduce((s, o) => s + (o.value ?? 0), 0);
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0];
  const initials = institution.name.split(' ').map(w => w[0]).join('').slice(0, 2);

  return (
    <div style={{ background: C.bg }} dir="rtl">

      {/* Modals */}
      {showAddContact && id && <AddContactModal institutionId={id} onClose={() => setShowAddContact(false)} onSaved={c => { setContacts(p => [c, ...p]); setShowAddContact(false); }} />}
      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} onSaved={c => { setContacts(p => p.map(x => x.id === c.id ? c : x)); setEditContact(null); }} />}
      {showAddOpportunity && id && <AddOpportunityModal institutionId={id} contacts={contacts} onClose={() => setShowAddOpportunity(false)} onSaved={o => { setOpportunities(p => [o, ...p]); setShowAddOpportunity(false); }} />}
      {editOpportunity && <EditOpportunityModal opportunity={editOpportunity} contacts={contacts} onClose={() => setEditOpportunity(null)} onSaved={o => { setOpportunities(p => p.map(x => x.id === o.id ? o : x)); setEditOpportunity(null); }} />}
      {showLogActivity && id && <LogActivityModal institutionId={id} contacts={contacts} opportunities={opportunities} onClose={() => setShowLogActivity(false)} onSaved={a => { setActivities(p => [a, ...p]); setShowLogActivity(false); }} />}
      {editActivity && <EditActivityModal activity={editActivity} contacts={contacts} opportunities={opportunities} onClose={() => setEditActivity(null)} onSaved={a => { setActivities(p => p.map(x => x.id === a.id ? a : x)); setEditActivity(null); }} />}
      {showEdit && <EditInstitutionModal institution={institution} onClose={() => setShowEdit(false)} onSaved={patch => { setInstitution(p => p ? { ...p, ...patch } : p); setShowEdit(false); }} />}
      {showWhatsApp && id && <SendWhatsAppModal contacts={contacts} institutionName={institution.name} institutionId={id} onClose={() => setShowWhatsApp(false)} onSent={a => { setActivities(p => [a, ...p]); setShowWhatsApp(false); }} />}
      {showEmail && id && <SendEmailModal contacts={contacts} institutionName={institution.name} institutionId={id} onClose={() => setShowEmail(false)} onSent={a => { setActivities(p => [a, ...p]); setShowEmail(false); }} />}

      {/* Header card */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px 0', flexShrink: 0 }}>
        {/* Back */}
        <button onClick={() => navigate('/crm')} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textSub, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← חזרה ל-CRM
        </button>

        {/* Name row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 44, height: 44, borderRadius: 9, background: C.accentBg, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{initials}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{institution.name}</span>
                {classBadge(institution.crm_class)}
                {stageBadge(institution.crm_stage)}
                {riskBadge(institution.crm_risk)}
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.textSub, flexWrap: 'wrap' }}>
                {institution.city && <span>🏙 {institution.city}</span>}
                {institution.crm_network && <span>🏫 {institution.crm_network}</span>}
                {institution.owner && <span>👤 <b style={{ color: C.text }}>{institution.owner.full_name}</b></span>}
                {primaryContact && <span>📞 <b style={{ color: C.text }}>{primaryContact.name}</b></span>}
                {institution.crm_last_contact_at && <span>⏱ {formatLastContact(institution.crm_last_contact_at)}</span>}
                {institution.crm_next_step && <span>⏭ <b style={{ color: C.accent }}>{institution.crm_next_step}{institution.crm_next_step_date ? ` — ${formatDate(institution.crm_next_step_date)}` : ''}</b></span>}
              </div>
            </div>
          </div>
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {contacts.length > 0 && <Btn variant="teal" sm onClick={() => setShowWhatsApp(true)}>📱 וואטסאפ</Btn>}
            {contacts.length > 0 && <Btn variant="ghost" sm onClick={() => setShowEmail(true)}>📧 מייל</Btn>}
            <Btn variant="secondary" sm onClick={() => setShowLogActivity(true)}>📝 תעד שיחה</Btn>
            <Btn sm onClick={() => setShowAddOpportunity(true)}>+ הזדמנות</Btn>
            <Btn variant="secondary" sm onClick={() => setShowAddContact(true)}>+ קשר</Btn>
            <Btn variant="ghost" sm onClick={() => setShowEdit(true)}>✏️ עריכה</Btn>
          </div>
        </div>

        {/* KPI mini cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <KpiCard label="אנשי קשר"         value={contacts.length}   color={C.accent}  bg={C.accentBg} />
          <KpiCard label="הזדמנויות פתוחות" value={openOpps}          color={C.warning} bg={C.warningBg} />
          <KpiCard label="סך הכנסות"         value={totalRevenue > 0 ? `₪${Math.round(totalRevenue / 1000)}K` : '₪0'} color={C.success} bg={C.successBg} />
          <KpiCard label="פוטנציאל חידוש"   value={institution.crm_potential != null ? `₪${Number(institution.crm_potential).toLocaleString('he-IL')}` : '—'} color={C.purple} bg={C.purpleBg} />
          <KpiCard label="AI Score"          value={institution.crm_ai_score ?? '—'}  color={C.ai}    bg={C.aiBg} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-transparent p-0 h-auto rounded-none border-b border-transparent w-full justify-start gap-0">
            {([
              { value: 'overview',       label: 'סקירה' },
              { value: 'contacts',       label: 'אנשי קשר' },
              { value: 'opportunities',  label: 'הזדמנויות' },
              { value: 'activity',       label: 'פעילות' },
              { value: 'communication',  label: 'תקשורת' },
              { value: 'files',          label: 'קבצים' },
              { value: 'ai',             label: 'AI' },
            ] as { value: string; label: string }[]).map(t => (
              <TabsTrigger key={t.value} value={t.value}
                className="rounded-none bg-transparent px-4 py-2 text-xs font-normal text-gray-500 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:font-semibold data-[state=active]:shadow-none data-[state=active]:bg-transparent"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div style={{ padding: '18px 0' }}>
            <TabsContent value="overview">
              <TabOverview institution={institution} activities={activities} contacts={contacts} onNotesSaved={n => setInstitution(p => p ? { ...p, crm_notes: n || null } : p)} />
            </TabsContent>
            <TabsContent value="contacts">
              <TabContacts contacts={contacts} onAdd={() => setShowAddContact(true)} onEdit={setEditContact} onDelete={deleteContact} />
            </TabsContent>
            <TabsContent value="opportunities">
              <TabOpportunities opportunities={opportunities} contacts={contacts} onAdd={() => setShowAddOpportunity(true)} onEdit={setEditOpportunity} onDelete={deleteOpportunity} />
            </TabsContent>
            <TabsContent value="activity">
              <TabActivity activities={activities} contacts={contacts} opportunities={opportunities} onLog={() => setShowLogActivity(true)} onEdit={setEditActivity} onDelete={deleteActivity} />
            </TabsContent>
            <TabsContent value="communication">
              <TabCommunication activities={activities} contacts={contacts} onWhatsApp={() => setShowWhatsApp(true)} onEmail={() => setShowEmail(true)} />
            </TabsContent>
            <TabsContent value="files">
              {id && <TabFiles institutionId={id} />}
            </TabsContent>
            <TabsContent value="ai">
              <TabAI institution={institution} opportunities={opportunities} activities={activities} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default CRMInstitution;
