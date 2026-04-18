import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  institution_id: string;
  name: string;
  stage: Stage;
  value: number | null;
  updated_at: string;
  contact_id: string | null;
  created_by: string | null;
  institution: { name: string; city?: string } | null;
  contact: { name: string } | null;
  instructor: { full_name: string } | null;
}

type Stage = 'יצירת קשר' | 'מעוניין' | 'סגירה' | 'זכה' | 'הפסיד';

interface KPIs {
  pipelineValue: number;
  openCount: number;
  winRate: number;
  avgDays: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const STAGE_META: Record<Stage, { color: string; bg: string; label: string }> = {
  'יצירת קשר': { color: '#6B7280', bg: '#F3F4F6', label: 'יצירת קשר' },
  'מעוניין':   { color: '#3B5BDB', bg: '#EEF2FF', label: 'מעוניין'   },
  'סגירה':     { color: '#D97706', bg: '#FFFBEB', label: 'סגירה'     },
  'זכה':       { color: '#16A34A', bg: '#F0FDF4', label: 'זכה'       },
  'הפסיד':     { color: '#DC2626', bg: '#FEF2F2', label: 'הפסיד'     },
};

const STAGES: Stage[] = ['יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHot(updatedAt: string): boolean {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] || '')
    .slice(0, 2)
    .join('');
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return '₪' + n.toLocaleString('he-IL');
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: KPIs }) {
  const items = [
    { label: 'שווי פייפליין',       value: fmt(kpis.pipelineValue) },
    { label: 'הזדמנויות פתוחות',    value: String(kpis.openCount) },
    { label: 'שיעור המרה',          value: kpis.winRate.toFixed(0) + '%' },
    { label: 'ממוצע ימים לסגירה',   value: kpis.avgDays ? kpis.avgDays.toFixed(0) + 'd' : '—' },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map((k) => (
        <div
          key={k.label}
          style={{
            flex: '1 1 160px',
            background: '#fff',
            border: '1px solid #E4E7ED',
            borderRadius: 10,
            padding: '14px 18px',
          }}
        >
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OppCard({
  opp,
  onDragStart,
}: {
  opp: Opportunity;
  onDragStart: (id: string) => void;
}) {
  const meta = STAGE_META[opp.stage];
  const hot = isHot(opp.updated_at);
  const instrName = opp.instructor?.full_name ?? null;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(opp.id)}
      style={{
        background: '#fff',
        border: '1px solid #E4E7ED',
        borderTop: `3px solid ${meta.color}`,
        borderRadius: 8,
        padding: '12px 14px',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>
          {opp.institution?.name ?? opp.name}
        </div>
        {hot && (
          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#D97706', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', marginRight: 6 }}>
            🔥 חם
          </span>
        )}
      </div>

      {/* Contact */}
      {opp.contact && (
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
          {opp.contact.name}
        </div>
      )}

      {/* Instructor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {instrName ? (
          <>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#7C3AED',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {initials(instrName)}
            </div>
            <span style={{ fontSize: 11, color: '#374151' }}>{instrName}</span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: '#EF4444' }}>⚠ ללא מדריך</span>
        )}
      </div>

      {/* Value + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>{fmt(opp.value)}</span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>
          {new Date(opp.updated_at).toLocaleDateString('he-IL')}
        </span>
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  opps,
  onDragStart,
  onDrop,
}: {
  stage: Stage;
  opps: Opportunity[];
  onDragStart: (id: string) => void;
  onDrop: (stage: Stage) => void;
}) {
  const meta = STAGE_META[stage];
  const [over, setOver] = useState(false);

  return (
    <div
      style={{ flex: '1 1 200px', minWidth: 190, display: 'flex', flexDirection: 'column' }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(stage); }}
    >
      {/* Column header */}
      <div
        style={{
          background: meta.bg,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: meta.color }}>{stage}</span>
        <span
          style={{
            fontSize: 11,
            background: meta.color,
            color: '#fff',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {opps.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        style={{
          flex: 1,
          minHeight: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: over ? '#F0F4FF' : 'transparent',
          borderRadius: 8,
          border: over ? '2px dashed #3B5BDB' : '2px dashed transparent',
          padding: over ? 6 : 0,
          transition: 'all 0.15s',
        }}
      >
        {opps.map((o) => (
          <OppCard key={o.id} opp={o} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

// ─── Automation types ─────────────────────────────────────────────────────────

type TriggerType = 'stage_enter' | 'no_contact' | 'deal_won';
type Channel = 'whatsapp' | 'email';

interface AutomationRule {
  id: string;
  trigger_type: TriggerType;
  trigger_value: string | null;
  channel: Channel;
  template_id: string | null;
  delay_minutes: number;
  is_active: boolean;
  created_by: string | null;
  template: { name: string; stage: string | null; channel: string } | null;
}

interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  stage: string | null;
}

interface RuleFormState {
  trigger_type: TriggerType;
  trigger_value: string;
  channel: Channel;
  template_id: string;
  delay_minutes: number;
  is_active: boolean;
}

const DELAY_OPTIONS: { label: string; value: number }[] = [
  { label: 'מיידי',          value: 0    },
  { label: 'אחרי שעה',       value: 60   },
  { label: 'אחרי 24 שעות',   value: 1440 },
  { label: 'אחרי 48 שעות',   value: 2880 },
];

const NO_CONTACT_DAYS = ['3', '7', '14'];

function getTriggerLabel(rule: AutomationRule): string {
  if (rule.trigger_type === 'stage_enter') return `כניסה לשלב: ${rule.trigger_value ?? ''}`;
  if (rule.trigger_type === 'no_contact')  return `ללא קשר ${rule.trigger_value ?? ''} ימים`;
  return 'זכייה בעסקה';
}

function getDelayLabel(minutes: number): string {
  const opt = DELAY_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  return `אחרי ${minutes} דקות`;
}

// ─── Edit Rule Modal ──────────────────────────────────────────────────────────

function EditRuleModal({
  rule,
  templates,
  onClose,
  onSaved,
  currentUserId,
}: {
  rule: AutomationRule | null;
  templates: MessageTemplate[];
  onClose: () => void;
  onSaved: () => void;
  currentUserId: string | undefined;
}) {
  const isNew = rule === null;
  const [form, setForm] = useState<RuleFormState>({
    trigger_type:   rule?.trigger_type   ?? 'stage_enter',
    trigger_value:  rule?.trigger_value  ?? STAGES[0],
    channel:        rule?.channel        ?? 'whatsapp',
    template_id:    rule?.template_id    ?? '',
    delay_minutes:  rule?.delay_minutes  ?? 0,
    is_active:      rule?.is_active      ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RuleFormState>(k: K, v: RuleFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const filteredTemplates = templates.filter((t) => t.channel === form.channel);

  const previewText = (): string => {
    const tLabel = (() => {
      if (form.trigger_type === 'stage_enter') return `כניסה לשלב: ${form.trigger_value}`;
      if (form.trigger_type === 'no_contact')  return `ללא קשר ${form.trigger_value} ימים`;
      return 'זכייה בעסקה';
    })();
    const tName = filteredTemplates.find((t) => t.id === form.template_id)?.name ?? '(ללא תבנית)';
    const dLabel = getDelayLabel(form.delay_minutes);
    return `כאשר ${tLabel} → שלח '${tName}' (${dLabel})`;
  };

  const handleSave = async () => {
    if (!form.template_id) { setError('יש לבחור תבנית'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      trigger_type:  form.trigger_type,
      trigger_value: form.trigger_value || null,
      channel:       form.channel,
      template_id:   form.template_id,
      delay_minutes: form.delay_minutes,
      is_active:     form.is_active,
      created_by:    currentUserId ?? null,
      updated_at:    new Date().toISOString(),
      ...(rule?.id ? { id: rule.id } : {}),
    };
    const { error: dbErr } = await supabase.from('crm_automation_rules').upsert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved();
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #E4E7ED',
    borderRadius: 6, fontSize: 13, color: '#111827', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '95vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">

        <div style={{ padding: '15px 20px', borderBottom: '1px solid #E4E7ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{isNew ? '+ חוק אוטומציה חדש' : '✏️ עריכת חוק'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#6B7280', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Trigger */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>טריגר</label>
            <select
              value={form.trigger_type}
              onChange={(e) => {
                const tt = e.target.value as TriggerType;
                set('trigger_type', tt);
                if (tt === 'stage_enter') set('trigger_value', STAGES[0]);
                else if (tt === 'no_contact') set('trigger_value', '7');
                else set('trigger_value', '');
              }}
              style={inputStyle}
            >
              <option value="stage_enter">כניסה לשלב</option>
              <option value="no_contact">ללא קשר X ימים</option>
              <option value="deal_won">זכייה בעסקה</option>
            </select>
          </div>

          {/* Trigger value */}
          {form.trigger_type === 'stage_enter' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>שלב</label>
              <select value={form.trigger_value} onChange={(e) => set('trigger_value', e.target.value)} style={inputStyle}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {form.trigger_type === 'no_contact' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>מספר ימים</label>
              <select value={form.trigger_value} onChange={(e) => set('trigger_value', e.target.value)} style={inputStyle}>
                {NO_CONTACT_DAYS.map((d) => <option key={d} value={d}>{d} ימים</option>)}
              </select>
            </div>
          )}

          {/* Channel */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ערוץ</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['whatsapp', 'email'] as Channel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => { set('channel', ch); set('template_id', ''); }}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${form.channel === ch ? '#3B5BDB' : '#E4E7ED'}`, background: form.channel === ch ? '#EEF2FF' : '#fff', color: form.channel === ch ? '#3B5BDB' : '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {ch === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>תבנית</label>
            <select value={form.template_id} onChange={(e) => set('template_id', e.target.value)} style={inputStyle}>
              <option value="">בחר תבנית...</option>
              {filteredTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.stage ? ` (${t.stage})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Delay */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>עיכוב</label>
            <select value={form.delay_minutes} onChange={(e) => set('delay_minutes', Number(e.target.value))} style={inputStyle}>
              {DELAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Preview */}
          {form.template_id && (
            <div style={{ padding: '10px 13px', background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: 8, fontSize: 12, color: '#3730A3', lineHeight: 1.6 }}>
              🔍 {previewText()}
            </div>
          )}

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '13px 20px', borderTop: '1px solid #E4E7ED', display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: saving ? '#9CA3AF' : '#3B5BDB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Automation Rules Section ─────────────────────────────────────────────────

function AutomationRulesSection({ currentUserId }: { currentUserId: string | undefined }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null | 'new'>('new' as never);
  const [showModal, setShowModal] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    const [{ data: ruleData }, { data: tmplData }] = await Promise.all([
      supabase
        .from('crm_automation_rules')
        .select('*, template:template_id(name, stage, channel)')
        .order('created_at', { ascending: false }),
      supabase
        .from('crm_message_templates')
        .select('id, name, channel, stage')
        .order('name'),
    ]);
    if (ruleData) setRules(ruleData as unknown as AutomationRule[]);
    if (tmplData) setTemplates(tmplData as MessageTemplate[]);
    setLoadingRules(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const toggleActive = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    await supabase
      .from('crm_automation_rules')
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
  };

  const openEdit = (rule: AutomationRule | null) => {
    setEditRule(rule);
    setShowModal(true);
  };

  const activeCount = rules.filter((r) => r.is_active).length;

  const channelIcon = (ch: Channel) => ch === 'whatsapp' ? '📱' : '📧';
  const channelLabel = (ch: Channel) => ch === 'whatsapp' ? 'וואטסאפ' : 'מייל';

  return (
    <>
      {showModal && (
        <EditRuleModal
          rule={editRule === 'new' ? null : editRule}
          templates={templates}
          onClose={() => setShowModal(false)}
          onSaved={loadRules}
          currentUserId={currentUserId}
        />
      )}

      <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        {/* Toggle header */}
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚙️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>חוקי אוטומציה</span>
            {activeCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A' }}>
                {activeCount} פעילים
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(null); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #3B5BDB', background: '#EEF2FF', color: '#3B5BDB', fontWeight: 600, cursor: 'pointer' }}
            >
              + הוסף
            </button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{expanded ? 'הסתר ▲' : 'הצג ▼'}</span>
          </div>
        </div>

        {/* Rules table */}
        {expanded && (
          <div style={{ borderTop: '1px solid #F0F2F5' }}>
            {loadingRules ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>טוען...</div>
            ) : rules.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                אין חוקי אוטומציה. לחץ "+ הוסף" כדי ליצור את הראשון.
              </div>
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
                      {/* Channel */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 13 }}>{channelIcon(rule.channel)}</span>
                        <span style={{ fontSize: 11, color: '#6B7280', marginRight: 4 }}>{channelLabel(rule.channel)}</span>
                      </td>
                      {/* Trigger badge */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#7C3AED' }}>
                          {getTriggerLabel(rule)}
                        </span>
                      </td>
                      {/* Action badge */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#CCFBF1', color: '#0F766E' }}>
                          שלח תבנית
                        </span>
                      </td>
                      {/* Template name */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                        {rule.template?.name ?? <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      {/* Delay */}
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>
                        {getDelayLabel(rule.delay_minutes)}
                      </td>
                      {/* Toggle */}
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => toggleActive(rule)}
                          style={{
                            width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                            background: rule.is_active ? '#3B5BDB' : '#D1D5DB', transition: 'background 0.2s',
                          }}
                          title={rule.is_active ? 'כבה' : 'הפעל'}
                        >
                          <span style={{
                            position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            transition: 'right 0.2s, left 0.2s',
                            ...(rule.is_active ? { right: 2 } : { left: 2 }),
                          }} />
                        </button>
                      </td>
                      {/* Edit */}
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => openEdit(rule)}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #E4E7ED', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                        >
                          ✏️ עריכה
                        </button>
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
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({ pipelineValue: 0, openCount: 0, winRate: 0, avgDays: 0 });
  const [filterInstructor, setFilterInstructor] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; full_name: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select(`
        id, institution_id, name, stage, value, updated_at, contact_id,
        institution:educational_institutions(name, city),
        contact:crm_contacts(name),
        instructor:profiles!crm_opportunities_created_by_fkey(full_name)
      `)
      .in('status', ['open'])
      .order('updated_at', { ascending: false });

    if (!error && data) {
      const rows = data as unknown as Opportunity[];
      setOpps(rows);

      // KPIs
      const pipelineValue = rows.reduce((s, o) => s + (o.value ?? 0), 0);
      const openCount = rows.length;

      // Win rate from ALL opportunities (not just open)
      const { data: allData } = await supabase
        .from('crm_opportunities')
        .select('status, created_at, updated_at')
        .in('status', ['won', 'lost', 'open']);

      let wonCount = 0, closedCount = 0, totalDays = 0;
      if (allData) {
        allData.forEach((o: any) => {
          if (o.status === 'won') { wonCount++; closedCount++; }
          if (o.status === 'lost') closedCount++;
          if (o.status === 'won' || o.status === 'lost') {
            const d = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 86400000;
            totalDays += d;
          }
        });
      }
      const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;
      const avgDays = closedCount > 0 ? totalDays / closedCount : 0;
      setKpis({ pipelineValue, openCount, winRate, avgDays });

      // Unique instructors + cities for filters
      const instrMap = new Map<string, string>();
      const citySet = new Set<string>();
      rows.forEach((o) => {
        if (o.instructor?.full_name) instrMap.set(o.created_by ?? '', o.instructor.full_name);
        const city = (o.institution as any)?.city;
        if (city) citySet.add(city);
      });
      setInstructors([...instrMap.entries()].map(([id, full_name]) => ({ id, full_name })));
      setCities([...citySet]);
    }
    setLoading(false);
  }

  async function handleDrop(targetStage: Stage) {
    if (!draggingId.current) return;
    const id = draggingId.current;
    draggingId.current = null;

    // Optimistic update
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, stage: targetStage } : o)));

    const { error } = await supabase
      .from('crm_opportunities')
      .update({ stage: targetStage, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Revert on failure
      load();
    }
  }

  const filtered = opps.filter((o) => {
    if (filterInstructor && o.created_by !== filterInstructor) return false;
    if (filterCity && (o.institution as any)?.city !== filterCity) return false;
    return true;
  });

  const byStage = (stage: Stage) => filtered.filter((o) => o.stage === stage);

  return (
    <div dir="rtl" style={{ padding: '24px', background: '#F8F9FB', minHeight: '100%' }}>
      <KpiStrip kpis={kpis} />

      {/* Automation Rules */}
      <AutomationRulesSection currentUserId={user?.id} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterInstructor}
          onChange={(e) => setFilterInstructor(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#374151' }}
        >
          <option value="">כל המדריכים</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.full_name}</option>
          ))}
        </select>

        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#374151' }}
        >
          <option value="">כל הערים</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {(filterInstructor || filterCity) && (
          <button
            onClick={() => { setFilterInstructor(''); setFilterCity(''); }}
            style={{ padding: '7px 14px', border: '1px solid #E4E7ED', borderRadius: 6, fontSize: 13, background: '#fff', color: '#6B7280', cursor: 'pointer' }}
          >
            ניקוי
          </button>
        )}
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>טוען...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              opps={byStage(stage)}
              onDragStart={(id) => { draggingId.current = id; }}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
