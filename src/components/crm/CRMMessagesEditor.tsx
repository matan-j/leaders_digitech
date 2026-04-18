import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { callCrmAI } from '@/hooks/useCrmAI';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'יצירת קשר' | 'מעוניין' | 'סגירה' | 'זכה' | 'הפסיד';
type Channel = 'whatsapp' | 'email';

interface Template {
  id: string;
  name: string;
  stage: Stage | null;
  channel: Channel;
  body: string;
  subject: string | null;
  variables: string[];
  created_by: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg: '#F8F9FB', surface: '#FFFFFF', border: '#E4E7ED', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  teal: '#0891B2', tealBg: '#CFFAFE',
  ai: '#0EA5E9', aiBg: '#E0F2FE',
};

const STAGES: Stage[] = ['יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד'];

const STAGE_COLOR: Record<Stage, string> = {
  'יצירת קשר': '#6B7280',
  'מעוניין': '#3B5BDB',
  'סגירה': '#D97706',
  'זכה': '#16A34A',
  'הפסיד': '#DC2626',
};

const STAGE_TIPS: Record<Stage, string> = {
  'יצירת קשר': 'שמור על טון חם ואישי. הכנס שם מוסד ספציפי.',
  'מעוניין': 'הזכר מה דיברתם. הצמד קישור להצעה.',
  'סגירה': 'צור urgency עדינה עם תאריך יעד ברור.',
  'זכה': 'חגוג! עבור מהר לפרטים הלוגיסטיים.',
  'הפסיד': 'השאר דלת פתוחה. אל תלחץ.',
};

const DEFAULTS: Record<Stage, Record<Channel, string>> = {
  'יצירת קשר': {
    whatsapp: 'שלום [שם] 👋\nאני [שם_שולח] מדיגי-טק.\nשמחתי להכיר את [שם_מוסד] — רצינו לשתף אתכם בתוכניות AI לתלמידים.\nניתן לקבוע שיחת היכרות קצרה? 🙏',
    email: 'שלום [שם],\n\nאני [שם_שולח] מדיגי-טק — חברה המתמחה בתוכניות AI ומיומנויות דיגיטל לבתי ספר.\n\nשמחתי להכיר את [שם_מוסד] ואשמח לתאם שיחה קצרה של 15 דקות.\n\nבברכה,\n[שם_שולח] | דיגי-טק',
  },
  'מעוניין': {
    whatsapp: 'היי [שם] 😊\nבהמשך לשיחתנו — מצורפת ההצעה עבור [שם_מוסד].\nנשמח לשמוע! 🚀\nדיגי-טק',
    email: 'שלום [שם],\n\nבהמשך לשיחתנו, מצורפת הצעת המחיר המפורטת עבור [שם_מוסד].\n\nאשמח לענות על שאלות ולקבוע שיחה.\n\nבברכה,\n[שם_שולח] | דיגי-טק',
  },
  'סגירה': {
    whatsapp: 'שלום [שם] 🤝\nנשמח לסגור את השיתוף עם [שם_מוסד]!\nניתן לשלוח חוזה?\nדיגי-טק',
    email: 'שלום [שם],\n\nאנחנו שמחים לקדם את השיתוף עם [שם_מוסד]!\nמצורף החוזה לחתימה עד [תאריך].\n\nבברכה,\n[שם_שולח] | דיגי-טק',
  },
  'זכה': {
    whatsapp: 'ברכות [שם]! 🎉\nשמחים להתחיל את הדרך עם [שם_מוסד]!\nנחזור בקרוב עם פרטי הפתיחה.\nדיגי-טק',
    email: 'שלום [שם],\n\nברכות! נשמח לפתוח את שיתוף הפעולה עם [שם_מוסד].\n\nנחזור אליכם תוך 48 שעות עם לוח זמנים.\n\nבברכה,\n[שם_שולח] | דיגי-טק',
  },
  'הפסיד': {
    whatsapp: 'שלום [שם],\nמעריכים מאוד את זמנכם 🙏\nאם המצב ישתנה — נשמח לחזור.\nדיגי-טק',
    email: 'שלום [שם],\n\nתודה על הזמן והנכונות לשוחח.\nמקווים לשיתוף פעולה בעתיד.\n\nבברכה,\n[שם_שולח] | דיגי-טק',
  },
};

const VARS = [
  { v: '[שם]', l: 'שם איש קשר' },
  { v: '[שם_מוסד]', l: 'שם מוסד' },
  { v: '[שם_שולח]', l: 'שמך' },
  { v: '[תאריך]', l: 'תאריך' },
  { v: '[תוכנית]', l: 'שם תוכנית' },
];

const WA_LIMIT = 1024;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CRMMessagesEditor() {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('יצירת קשר');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [texts, setTexts] = useState<Record<Stage, Record<Channel, string>>>(
    JSON.parse(JSON.stringify(DEFAULTS))
  );
  const [templateIds, setTemplateIds] = useState<Partial<Record<string, string>>>({});
  const [hasTemplate, setHasTemplate] = useState<Partial<Record<string, boolean>>>({});
  const [genning, setGenning] = useState(false);
  const [saveState, setSaveState] = useState<Partial<Record<string, 'saved' | 'dirty'>>>({});
  const [showPreview, setShowPreview] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const key = (s: Stage, c: Channel) => `${s}__${c}`;

  // Load existing templates for all stages on mount
  useEffect(() => {
    async function loadAll() {
      const { data } = await supabase
        .from('crm_message_templates')
        .select('id, stage, channel, body, subject, name, variables, created_by');
      if (!data) return;
      const newTexts = JSON.parse(JSON.stringify(DEFAULTS)) as typeof texts;
      const newIds: Partial<Record<string, string>> = {};
      const newHas: Partial<Record<string, boolean>> = {};
      for (const tpl of data as Template[]) {
        const s = tpl.stage as Stage | null;
        const c = tpl.channel as Channel;
        if (s && STAGES.includes(s)) {
          newTexts[s][c] = tpl.body;
          newIds[key(s, c)] = tpl.id;
          newHas[key(s, c)] = true;
        }
      }
      setTexts(newTexts);
      setTemplateIds(newIds);
      setHasTemplate(newHas);
    }
    loadAll();
  }, []);

  const txt = texts[stage][channel];
  const setTxt = (v: string) => {
    setTexts(p => ({ ...p, [stage]: { ...p[stage], [channel]: v } }));
    setSaveState(p => ({ ...p, [key(stage, channel)]: 'dirty' }));
  };

  const insertVar = (v: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? txt.length;
    const e = ta.selectionEnd ?? txt.length;
    const next = txt.slice(0, s) + v + txt.slice(e);
    setTxt(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
  };

  const preview = txt
    .replace(/\[שם\]/g, 'אבי בן-דוד')
    .replace(/\[שם_מוסד\]/g, 'עיריית ת״א')
    .replace(/\[שם_שולח\]/g, 'יעל כהן')
    .replace(/\[תאריך\]/g, '30.6.25')
    .replace(/\[תוכנית\]/g, 'Creators AI');

  const generateAI = async () => {
    setGenning(true);
    try {
      const result = await callCrmAI('generate_template', { stage, channel });
      if (result) setTxt(result.trim());
    } catch {
      // silent — keep existing text
    }
    setGenning(false);
  };

  const doSave = async () => {
    const existingId = templateIds[key(stage, channel)];
    const payload = {
      name: `${stage} — ${channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'}`,
      stage,
      channel,
      body: txt,
      subject: channel === 'email' ? `הודעה — ${stage}` : null,
      variables: VARS.map(v => v.v),
      created_by: user?.id ?? null,
    };

    if (existingId) {
      await supabase.from('crm_message_templates').update(payload).eq('id', existingId);
    } else {
      const { data } = await supabase
        .from('crm_message_templates')
        .insert([payload])
        .select('id')
        .single();
      if (data) {
        setTemplateIds(p => ({ ...p, [key(stage, channel)]: data.id }));
        setHasTemplate(p => ({ ...p, [key(stage, channel)]: true }));
      }
    }

    setSaveState(p => ({ ...p, [key(stage, channel)]: 'saved' }));
    setTimeout(() => setSaveState(p => ({ ...p, [key(stage, channel)]: undefined })), 2500);
  };

  const isEdited = txt !== DEFAULTS[stage][channel];
  const savedKey = saveState[key(stage, channel)];

  return (
    <div dir="rtl" style={{ display: 'flex', height: 'calc(100vh - 108px)', overflow: 'hidden' }}>

      {/* ── LEFT RAIL ── */}
      <div style={{ width: 186, flexShrink: 0, borderLeft: `1px solid ${C.border}`, background: C.surface, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          שלב בפייפליין
        </div>

        {STAGES.map(s => {
          const color = STAGE_COLOR[s];
          const waHas = !!hasTemplate[key(s, 'whatsapp')];
          const emHas = !!hasTemplate[key(s, 'email')];
          const active = stage === s;
          return (
            <div
              key={s}
              onClick={() => setStage(s)}
              style={{
                padding: '11px 14px',
                cursor: 'pointer',
                borderRight: active ? `3px solid ${color}` : '3px solid transparent',
                background: active ? `${color}10` : 'transparent',
                borderBottom: `1px solid ${C.borderLight}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? color : C.text }}>{s}</span>
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 9, opacity: waHas ? 1 : 0.25 }}>📱</span>
                <span style={{ fontSize: 9, opacity: emHas ? 1 : 0.25 }}>📧</span>
              </div>
            </div>
          );
        })}

        {/* Channel toggle */}
        <div style={{ marginTop: 'auto', borderTop: `1px solid ${C.border}`, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 7 }}>ערוץ</div>
          {([
            { id: 'whatsapp' as Channel, l: '📱 וואטסאפ', c: C.teal },
            { id: 'email' as Channel, l: '📧 מייל', c: C.accent },
          ] as const).map(t => (
            <div
              key={t.id}
              onClick={() => setChannel(t.id)}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                marginBottom: 5,
                cursor: 'pointer',
                background: channel === t.id ? `${t.c}15` : C.bg,
                border: `1px solid ${channel === t.id ? t.c : C.border}`,
                fontSize: 12,
                fontWeight: channel === t.id ? 700 : 400,
                color: channel === t.id ? t.c : C.textSub,
              }}
            >
              {t.l}
            </div>
          ))}
        </div>
      </div>

      {/* ── CENTER: editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: C.surface }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{stage}</span>
          <span style={{ fontSize: 12, color: C.textDim }}>—</span>
          <span style={{ fontSize: 12, color: channel === 'whatsapp' ? C.teal : C.accent, fontWeight: 600 }}>
            {channel === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'}
          </span>
          {isEdited && savedKey !== 'saved' && (
            <span style={{ fontSize: 10, color: C.warning, fontWeight: 600, background: C.warningBg, padding: '1px 6px', borderRadius: 4 }}>
              ● לא נשמר
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowPreview(p => !p)}
            style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, cursor: 'pointer', color: C.textSub, fontWeight: 600 }}
          >
            {showPreview ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה'}
          </button>
          <button
            onClick={generateAI}
            disabled={genning}
            style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.ai}30`, background: C.aiBg, color: C.ai, fontSize: 12, cursor: genning ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: genning ? 0.6 : 1, minWidth: 110 }}
          >
            {genning ? '⟳ מייצר...' : '✨ צור עם AI'}
          </button>
        </div>

        {/* Variables bar */}
        <div style={{ padding: '8px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: C.bg, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>הכנס משתנה:</span>
          {VARS.map(({ v, l }) => (
            <button
              key={v}
              title={l}
              onClick={() => insertVar(v)}
              style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.accent}30`, background: C.accentBg, color: C.accent, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Textarea + preview */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Textarea */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 18px', gap: 8 }}>
            <textarea
              ref={taRef}
              value={txt}
              onChange={e => setTxt(e.target.value)}
              maxLength={channel === 'whatsapp' ? WA_LIMIT : undefined}
              style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '13px 15px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, lineHeight: 1.8, resize: 'none', outline: 'none', fontFamily: 'inherit', color: C.text, background: C.surface }}
              placeholder={`כתוב כאן את הודעת ה${channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'} לשלב "${stage}"...`}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {channel === 'whatsapp' && (
                <span style={{ fontSize: 11, color: txt.length > WA_LIMIT ? C.danger : C.textDim }}>
                  {txt.length}/{WA_LIMIT} תווים
                </span>
              )}
              <div style={{ flex: 1 }} />
              {isEdited && (
                <button
                  onClick={() => setTxt(DEFAULTS[stage][channel])}
                  style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, cursor: 'pointer', color: C.textSub, fontWeight: 600 }}
                >
                  ↩ אפס
                </button>
              )}
              <button
                onClick={doSave}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: savedKey === 'saved' ? C.success : C.accent, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, minWidth: 130 }}
              >
                {savedKey === 'saved' ? '✓ נשמר' : '💾 שמור תבנית'}
              </button>
            </div>
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: '14px 16px', background: C.bg, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                תצוגה מקדימה
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>עם ערכים לדוגמה</div>

              {channel === 'whatsapp' ? (
                <div style={{ background: '#E9FBD8', borderRadius: '0 12px 12px 12px', padding: '11px 13px', fontSize: 13, lineHeight: 1.7, color: '#1a1a1a', whiteSpace: 'pre-wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {preview}
                </div>
              ) : (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                    <div style={{ fontSize: 10, color: C.textSub }}>מאת: יעל כהן &lt;yael@digitek.co.il&gt;</div>
                    <div style={{ fontSize: 10, color: C.textSub }}>אל: אבי בן-דוד &lt;avi@tlv.gov.il&gt;</div>
                  </div>
                  <div style={{ padding: '11px 13px', fontSize: 12, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-wrap' }}>{preview}</div>
                </div>
              )}

              {/* Stage tip */}
              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: C.aiBg, border: `1px solid ${C.ai}20` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ai, marginBottom: 5 }}>💡 טיפ לשלב זה</div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{STAGE_TIPS[stage]}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
