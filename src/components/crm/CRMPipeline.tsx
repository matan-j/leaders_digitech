import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_won: boolean;
  is_lost: boolean;
}

interface InstitutionRow {
  id: string;
  name: string;
  city: string | null;
  crm_stage: string | null;
  crm_class: string | null;
  crm_last_contact_at: string | null;
  crm_potential: number | null;
  instructor: { id: string; full_name: string } | null;
}

interface KPIs {
  pipelineValue: number;
  totalCount: number;
  wonCount: number;
  winRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageBg(color: string): string {
  return color + '18';
}

function isHot(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 3 * 24 * 60 * 60 * 1000;
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0] || '').slice(0, 2).join('');
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return '₪' + n.toLocaleString('he-IL');
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: KPIs }) {
  const items = [
    { label: 'שווי פוטנציאל',  value: fmt(kpis.pipelineValue) },
    { label: 'מוסדות בפייפליין', value: String(kpis.totalCount) },
    { label: 'לקוחות (זכו)',    value: String(kpis.wonCount) },
    { label: 'שיעור המרה',      value: kpis.winRate.toFixed(0) + '%' },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map((k) => (
        <div key={k.label} style={{ flex: '1 1 160px', background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Institution card ─────────────────────────────────────────────────────────

function InstitutionCard({ inst, stageColor, onDragStart }: { inst: InstitutionRow; stageColor: string; onDragStart: (id: string) => void }) {
  const hot = isHot(inst.crm_last_contact_at);
  const instrName = inst.instructor?.full_name ?? null;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(inst.id)}
      style={{ background: '#fff', border: '1px solid #E4E7ED', borderTop: `3px solid ${stageColor}`, borderRadius: 8, padding: '12px 14px', cursor: 'grab', userSelect: 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>{inst.name}</div>
        {hot && (
          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#D97706', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', marginRight: 6 }}>
            🔥 חם
          </span>
        )}
      </div>
      {inst.city && <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>📍 {inst.city}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {instrName ? (
          <>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C3AED', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {initials(instrName)}
            </div>
            <span style={{ fontSize: 11, color: '#374151' }}>{instrName}</span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: '#EF4444' }}>⚠ ללא מדריך</span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{fmt(inst.crm_potential)}</span>
        {inst.crm_last_contact_at && (
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            {new Date(inst.crm_last_contact_at).toLocaleDateString('he-IL')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ stage, rows, onDragStart, onDrop }: {
  stage: PipelineStage;
  rows: InstitutionRow[];
  onDragStart: (id: string) => void;
  onDrop: (stageName: string) => void;
}) {
  const [over, setOver] = useState(false);
  const color = stage.color;
  const bg = stageBg(color);

  return (
    <div
      style={{ flex: '1 1 200px', minWidth: 190, display: 'flex', flexDirection: 'column' }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(stage.name); }}
    >
      <div style={{ background: bg, borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color }}>{stage.name}</span>
        <span style={{ fontSize: 11, background: color, color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {rows.length}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 100, display: 'flex', flexDirection: 'column', gap: 8, background: over ? '#F0F4FF' : 'transparent', borderRadius: 8, border: over ? '2px dashed #3B5BDB' : '2px dashed transparent', padding: over ? 6 : 0, transition: 'all 0.15s' }}>
        {rows.map((inst) => (
          <InstitutionCard key={inst.id} inst={inst} stageColor={color} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

// ─── Edit Stages Modal ────────────────────────────────────────────────────────

function EditStagesModal({ stages, onClose, onSaved }: { stages: PipelineStage[]; onClose: () => void; onSaved: () => void }) {
  const [local, setLocal] = useState<PipelineStage[]>([...stages].sort((a, b) => a.order_index - b.order_index));
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<PipelineStage>) =>
    setLocal((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addStage = () => {
    const tempId = 'new_' + Date.now();
    setLocal((prev) => [...prev, { id: tempId, name: '', color: '#6B7280', order_index: prev.length, is_won: false, is_lost: false }]);
  };

  const removeStage = (id: string) => {
    if (!id.startsWith('new_')) setDeletedIds((prev) => [...prev, id]);
    setLocal((prev) => prev.filter((s) => s.id !== id));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setLocal((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((s, i) => ({ ...s, order_index: i }));
    });
  };

  const moveDown = (idx: number) => {
    setLocal((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((s, i) => ({ ...s, order_index: i }));
    });
  };

  const save = async () => {
    const invalid = local.find((s) => !s.name.trim());
    if (invalid) { setError('יש למלא שם לכל השלבים'); return; }
    setSaving(true);
    setError(null);

    const upsertData = local.map((s, i) => ({
      ...(s.id.startsWith('new_') ? {} : { id: s.id }),
      name: s.name.trim(),
      color: s.color,
      order_index: i,
      is_won: s.is_won,
      is_lost: s.is_lost,
    }));

    const { error: uErr } = await supabase.from('crm_pipeline_stages').upsert(upsertData);
    if (uErr) { setError(uErr.message); setSaving(false); return; }

    if (deletedIds.length > 0) {
      await supabase.from('crm_pipeline_stages').delete().in('id', deletedIds);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const inputStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #E4E7ED', borderRadius: 5, fontSize: 13, color: '#111827', outline: 'none', width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '95vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', maxHeight: '85vh' }} dir="rtl">
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #E4E7ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>⚙️ עריכת שלבי פייפליין</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#6B7280', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {local.map((stage, idx) => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #E4E7ED', borderRadius: 8, background: '#F8F9FB' }}>
                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => update(stage.id, { color: e.target.value })}
                  style={{ width: 28, height: 28, borderRadius: 5, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
                />
                <input
                  value={stage.name}
                  onChange={(e) => update(stage.id, { name: e.target.value })}
                  placeholder="שם השלב"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16A34A', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stage.is_won} onChange={(e) => update(stage.id, { is_won: e.target.checked, is_lost: false })} />
                  זכייה
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#DC2626', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stage.is_lost} onChange={(e) => update(stage.id, { is_lost: e.target.checked, is_won: false })} />
                  הפסד
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 10, color: '#6B7280', padding: '1px 3px', opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === local.length - 1} style={{ background: 'none', border: 'none', cursor: idx === local.length - 1 ? 'not-allowed' : 'pointer', fontSize: 10, color: '#6B7280', padding: '1px 3px', opacity: idx === local.length - 1 ? 0.3 : 1 }}>▼</button>
                </div>
                <button onClick={() => removeStage(stage.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#DC2626', padding: '0 4px' }}>🗑</button>
              </div>
            ))}
          </div>
          <button onClick={addStage} style={{ marginTop: 10, width: '100%', padding: '8px', border: '1px dashed #E4E7ED', borderRadius: 8, background: '#F8F9FB', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            + הוסף שלב
          </button>
          {error && <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEE2E2', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>}
        </div>

        <div style={{ padding: '13px 20px', borderTop: '1px solid #E4E7ED', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: saving ? '#9CA3AF' : '#3B5BDB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Automation Rules Section (preserved from previous implementation) ────────

const DELAY_OPTIONS: { label: string; value: number }[] = [
  { label: 'מיידי', value: 0 }, { label: 'אחרי שעה', value: 60 },
  { label: 'אחרי 24 שעות', value: 1440 }, { label: 'אחרי 48 שעות', value: 2880 },
];
const NO_CONTACT_DAYS = ['3', '7', '14'];

type TriggerType = 'stage_enter' | 'no_contact' | 'deal_won';
type Channel = 'whatsapp' | 'email';

interface AutomationRule {
  id: string; trigger_type: TriggerType; trigger_value: string | null;
  channel: Channel; template_id: string | null; delay_minutes: number;
  is_active: boolean; created_by: string | null;
  template: { name: string; stage: string | null; channel: string } | null;
}
interface MessageTemplate { id: string; name: string; channel: string; stage: string | null; }
interface RuleFormState { trigger_type: TriggerType; trigger_value: string; channel: Channel; template_id: string; delay_minutes: number; is_active: boolean; }

const PIPELINE_STAGES_FOR_RULES = ['יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד'];

function getTriggerLabel(rule: AutomationRule): string {
  if (rule.trigger_type === 'stage_enter') return `כניסה לשלב: ${rule.trigger_value ?? ''}`;
  if (rule.trigger_type === 'no_contact') return `ללא קשר ${rule.trigger_value ?? ''} ימים`;
  return 'זכייה בעסקה';
}
function getDelayLabel(minutes: number): string {
  return DELAY_OPTIONS.find((o) => o.value === minutes)?.label ?? `אחרי ${minutes} דקות`;
}

function EditRuleModal({ rule, templates, onClose, onSaved, currentUserId }: { rule: AutomationRule | null; templates: MessageTemplate[]; onClose: () => void; onSaved: () => void; currentUserId: string | undefined }) {
  const isNew = rule === null;
  const [form, setForm] = useState<RuleFormState>({ trigger_type: rule?.trigger_type ?? 'stage_enter', trigger_value: rule?.trigger_value ?? PIPELINE_STAGES_FOR_RULES[0], channel: rule?.channel ?? 'whatsapp', template_id: rule?.template_id ?? '', delay_minutes: rule?.delay_minutes ?? 0, is_active: rule?.is_active ?? true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RuleFormState>(k: K, v: RuleFormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const filteredTemplates = templates.filter((t) => t.channel === form.channel);

  const previewText = () => {
    const tLabel = form.trigger_type === 'stage_enter' ? `כניסה לשלב: ${form.trigger_value}` : form.trigger_type === 'no_contact' ? `ללא קשר ${form.trigger_value} ימים` : 'זכייה בעסקה';
    const tName = filteredTemplates.find((t) => t.id === form.template_id)?.name ?? '(ללא תבנית)';
    return `כאשר ${tLabel} → שלח '${tName}' (${getDelayLabel(form.delay_minutes)})`;
  };

  const handleSave = async () => {
    if (!form.template_id) { setError('יש לבחור תבנית'); return; }
    setSaving(true); setError(null);
    const payload = { trigger_type: form.trigger_type, trigger_value: form.trigger_value || null, channel: form.channel, template_id: form.template_id, delay_minutes: form.delay_minutes, is_active: form.is_active, created_by: currentUserId ?? null, updated_at: new Date().toISOString(), ...(rule?.id ? { id: rule.id } : {}) };
    const { error: dbErr } = await supabase.from('crm_automation_rules').upsert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved(); onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, color: '#111827', background: '#fff', outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '95vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #E4E7ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{isNew ? '+ חוק אוטומציה חדש' : '✏️ עריכת חוק'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#6B7280', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>טריגר</label>
            <select value={form.trigger_type} onChange={(e) => { const tt = e.target.value as TriggerType; set('trigger_type', tt); set('trigger_value', tt === 'stage_enter' ? PIPELINE_STAGES_FOR_RULES[0] : tt === 'no_contact' ? '7' : ''); }} style={inputStyle}>
              <option value="stage_enter">כניסה לשלב</option>
              <option value="no_contact">ללא קשר X ימים</option>
              <option value="deal_won">זכייה בעסקה</option>
            </select>
          </div>
          {form.trigger_type === 'stage_enter' && <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>שלב</label><select value={form.trigger_value} onChange={(e) => set('trigger_value', e.target.value)} style={inputStyle}>{PIPELINE_STAGES_FOR_RULES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
          {form.trigger_type === 'no_contact' && <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>מספר ימים</label><select value={form.trigger_value} onChange={(e) => set('trigger_value', e.target.value)} style={inputStyle}>{NO_CONTACT_DAYS.map((d) => <option key={d} value={d}>{d} ימים</option>)}</select></div>}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ערוץ</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['whatsapp', 'email'] as Channel[]).map((ch) => (
                <button key={ch} onClick={() => { set('channel', ch); set('template_id', ''); }} style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${form.channel === ch ? '#3B5BDB' : '#E4E7ED'}`, background: form.channel === ch ? '#EEF2FF' : '#fff', color: form.channel === ch ? '#3B5BDB' : '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {ch === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>תבנית</label>
            <select value={form.template_id} onChange={(e) => set('template_id', e.target.value)} style={inputStyle}>
              <option value="">בחר תבנית...</option>
              {filteredTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.stage ? ` (${t.stage})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>עיכוב</label>
            <select value={form.delay_minutes} onChange={(e) => set('delay_minutes', Number(e.target.value))} style={inputStyle}>
              {DELAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {form.template_id && <div style={{ padding: '10px 13px', background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: 8, fontSize: 12, color: '#3730A3', lineHeight: 1.6 }}>🔍 {previewText()}</div>}
          {error && <div style={{ padding: '8px 12px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>}
        </div>
        <div style={{ padding: '13px 20px', borderTop: '1px solid #E4E7ED', display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: saving ? '#9CA3AF' : '#3B5BDB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'שומר...' : 'שמור'}</button>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function AutomationRulesSection({ currentUserId }: { currentUserId: string | undefined }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    const [{ data: ruleData }, { data: tmplData }] = await Promise.all([
      supabase.from('crm_automation_rules').select('*, template:template_id(name, stage, channel)').order('created_at', { ascending: false }),
      supabase.from('crm_message_templates').select('id, name, channel, stage').order('name'),
    ]);
    if (ruleData) setRules(ruleData as unknown as AutomationRule[]);
    if (tmplData) setTemplates(tmplData as MessageTemplate[]);
    setLoadingRules(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const toggleActive = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    await supabase.from('crm_automation_rules').update({ is_active: !rule.is_active, updated_at: new Date().toISOString() }).eq('id', rule.id);
  };

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <>
      {showModal && <EditRuleModal rule={editRule} templates={templates} onClose={() => setShowModal(false)} onSaved={loadRules} currentUserId={currentUserId} />}
      <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded((v) => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚙️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>חוקי אוטומציה</span>
            {activeCount > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A' }}>{activeCount} פעילים</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); setEditRule(null); setShowModal(true); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #3B5BDB', background: '#EEF2FF', color: '#3B5BDB', fontWeight: 600, cursor: 'pointer' }}>+ הוסף</button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{expanded ? 'הסתר ▲' : 'הצג ▼'}</span>
          </div>
        </div>
        {expanded && (
          <div style={{ borderTop: '1px solid #F0F2F5' }}>
            {loadingRules ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>טוען...</div>
            ) : rules.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>אין חוקי אוטומציה.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB' }}>
                    {['ערוץ', 'טריגר', 'פעולה', 'שם תבנית', 'עיכוב', 'פעיל', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E4E7ED', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid #F0F2F5' }}>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 13 }}>{rule.channel === 'whatsapp' ? '📱' : '📧'}</span><span style={{ fontSize: 11, color: '#6B7280', marginRight: 4 }}>{rule.channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'}</span></td>
                      <td style={{ padding: '10px 12px' }}><span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#7C3AED' }}>{getTriggerLabel(rule)}</span></td>
                      <td style={{ padding: '10px 12px' }}><span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#CCFBF1', color: '#0F766E' }}>שלח תבנית</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{rule.template?.name ?? <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>{getDelayLabel(rule.delay_minutes)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => toggleActive(rule)} style={{ width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: rule.is_active ? '#3B5BDB' : '#D1D5DB', transition: 'background 0.2s' }}>
                          <span style={{ position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'right 0.2s, left 0.2s', ...(rule.is_active ? { right: 2 } : { left: 2 }) }} />
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => { setEditRule(rule); setShowModal(true); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #E4E7ED', background: '#fff', color: '#374151', cursor: 'pointer' }}>✏️ עריכה</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMPipeline() {
  const { user } = useAuth();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({ pipelineValue: 0, totalCount: 0, wonCount: 0, winRate: 0 });
  const [filterInstructor, setFilterInstructor] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; full_name: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showEditStages, setShowEditStages] = useState(false);
  const draggingId = useRef<string | null>(null);

  const loadStages = useCallback(async () => {
    const { data } = await supabase.from('crm_pipeline_stages').select('*').order('order_index');
    if (data) setStages(data as PipelineStage[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('educational_institutions')
      .select(`
        id, name, city, crm_stage, crm_class, crm_last_contact_at, crm_potential,
        instructor:crm_assigned_instructor_id (id, full_name)
      `)
      .in('crm_class', ['Lead', 'Customer'])
      .order('name');

    if (!error && data) {
      const rows = data as unknown as InstitutionRow[];
      setInstitutions(rows);

      const pipelineValue = rows.reduce((s, r) => s + (r.crm_potential ?? 0), 0);
      const totalCount = rows.length;
      const wonCount = rows.filter((r) => r.crm_class === 'Customer').length;
      const winRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;
      setKpis({ pipelineValue, totalCount, wonCount, winRate });

      const instrMap = new Map<string, string>();
      const citySet = new Set<string>();
      rows.forEach((r) => {
        if (r.instructor?.id && r.instructor.full_name) instrMap.set(r.instructor.id, r.instructor.full_name);
        if (r.city) citySet.add(r.city);
      });
      setInstructors([...instrMap.entries()].map(([id, full_name]) => ({ id, full_name })));
      setCities([...citySet]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStages();
    load();
  }, [loadStages, load]);

  async function handleDrop(targetStageName: string) {
    if (!draggingId.current) return;
    const id = draggingId.current;
    draggingId.current = null;

    const targetStage = stages.find((s) => s.name === targetStageName);
    const oldStage = institutions.find((r) => r.id === id)?.crm_stage ?? null;

    setInstitutions((prev) => prev.map((r) => r.id === id ? { ...r, crm_stage: targetStageName } : r));

    const patch: Record<string, string> = { crm_stage: targetStageName };
    if (targetStage?.is_won) patch.crm_class = 'Customer';
    if (targetStage?.is_lost) patch.crm_class = 'Lead';

    const { error } = await supabase.from('educational_institutions').update(patch).eq('id', id);
    if (error) { load(); return; }

    supabase.functions.invoke('crm-automation-trigger', {
      body: { institution_id: id, new_stage: targetStageName, old_stage: oldStage },
    }).catch(() => { /* fire-and-forget */ });
  }

  const firstStageName = stages[0]?.name ?? '';

  const filtered = institutions.filter((r) => {
    if (filterInstructor && r.instructor?.id !== filterInstructor) return false;
    if (filterCity && r.city !== filterCity) return false;
    return true;
  });

  const byStage = (stageName: string, isFirst: boolean) =>
    filtered.filter((r) => isFirst ? (r.crm_stage === stageName || r.crm_stage === null) : r.crm_stage === stageName);

  return (
    <div dir="rtl" style={{ padding: '24px', background: '#F8F9FB', minHeight: '100%' }}>
      {showEditStages && (
        <EditStagesModal
          stages={stages}
          onClose={() => setShowEditStages(false)}
          onSaved={() => { loadStages(); }}
        />
      )}

      <KpiStrip kpis={kpis} />

      <AutomationRulesSection currentUserId={user?.id} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterInstructor} onChange={(e) => setFilterInstructor(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#374151' }}>
          <option value="">כל המדריכים</option>
          {instructors.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
        </select>
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#374151' }}>
          <option value="">כל הערים</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterInstructor || filterCity) && (
          <button onClick={() => { setFilterInstructor(''); setFilterCity(''); }} style={{ padding: '7px 14px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#6B7280', cursor: 'pointer' }}>ניקוי</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowEditStages(true)} style={{ padding: '7px 14px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
          ⚙️ ערוך שלבים
        </button>
      </div>

      {/* Kanban */}
      {loading || stages.length === 0 ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>טוען...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {stages.map((stage, idx) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              rows={byStage(stage.name, idx === 0)}
              onDragStart={(id) => { draggingId.current = id; }}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
