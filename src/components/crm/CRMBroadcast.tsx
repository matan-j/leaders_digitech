import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'whatsapp' | 'email';

interface AudienceList {
  id: string;
  name: string;
  desc: string;
  count: number | null;
  filter: Record<string, unknown>;
}

interface Template {
  id: string;
  name: string;
  stage: string | null;
  channel: Channel;
  body: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#F8F9FB', surface: '#FFFFFF', border: '#E4E7ED', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  teal: '#0891B2', tealBg: '#CFFAFE',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  gray: '#6B7280', grayBg: '#F3F4F6',
};

// ─── Stage badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const map: Record<string, [string, string]> = {
    'יצירת קשר': [C.textSub, C.grayBg],
    'מעוניין': [C.accent, C.accentBg],
    'סגירה': [C.warning, C.warningBg],
    'זכה': [C.success, C.successBg],
    'הפסיד': [C.danger, C.dangerBg],
    'Customer': [C.success, C.successBg],
  };
  const [color, bg] = map[stage] ?? [C.gray, C.grayBg];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  );
}

// ─── Steps indicator ──────────────────────────────────────────────────────────

function Steps({ step, onGoTo }: { step: number; onGoTo: (i: number) => void }) {
  const labels = ['בחר קהל', 'בחר הודעה', 'שלח'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {labels.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: i <= step ? 'pointer' : 'default' }}
            onClick={() => { if (i <= step) onGoTo(i); }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i < step ? C.success : i === step ? C.accent : C.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i === step ? C.text : C.textSub }}>{s}</span>
          </div>
          {i < 2 && <div style={{ width: 30, height: 1, background: i < step ? C.success : C.border, margin: '0 8px' }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMBroadcast() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [selList, setSelList] = useState<AudienceList | null>(null);
  const [selTpl, setSelTpl] = useState<Template | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audiences, setAudiences] = useState<AudienceList[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Build audience lists with live counts from Supabase
  useEffect(() => {
    async function buildAudiences() {
      setLoadingCounts(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [newLeads, noReply, renewal, allActive] = await Promise.all([
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_class', 'Lead').gte('created_at', monthStart),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_stage', 'מעוניין').lt('crm_last_contact_at', sevenDaysAgo),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_class', 'Customer'),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).in('crm_class', ['Lead', 'Customer']),
      ]);

      setAudiences([
        { id: 'new_leads', name: 'לידים חדשים (החודש)', desc: 'הצטרפו החודש', count: newLeads.count, filter: { crm_class: 'Lead', since: monthStart } },
        { id: 'no_reply', name: 'מעוניין — ללא מענה 7 ימים', desc: 'לא ענו בשבוע', count: noReply.count, filter: { crm_stage: 'מעוניין', no_reply: true } },
        { id: 'renewal', name: 'לקוחות — פוטנציאל חידוש', desc: 'לקוחות פעילים', count: renewal.count, filter: { crm_class: 'Customer' } },
        { id: 'all_active', name: 'כל הלידים הפעילים', desc: 'לא הפסידו', count: allActive.count, filter: { crm_class_in: ['Lead', 'Customer'] } },
        { id: 'manual', name: 'רשימה ידנית', desc: 'בחירה ידנית ממוסדות', count: null, filter: { manual: true } },
      ]);
      setLoadingCounts(false);
    }
    buildAudiences();
  }, []);

  // Load templates filtered by channel
  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('crm_message_templates')
        .select('id, name, stage, channel, body')
        .eq('channel', channel);
      setTemplates((data ?? []) as Template[]);
    }
    loadTemplates();
  }, [channel]);

  const doSend = async () => {
    if (!selList || !selTpl) return;
    setSending(true);
    await supabase.from('crm_broadcasts').insert([{
      name: `${selList.name} — ${selTpl.name}`,
      channel,
      template_id: selTpl.id,
      audience_type: selList.id,
      audience_filter: selList.filter,
      recipient_count: selList.count ?? 0,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    }]);
    setSending(false);
    setSent(true);
  };

  const reset = () => {
    setStep(0); setSelList(null); setSelTpl(null); setSent(false); setSending(false);
  };

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto', minHeight: '100%' }}>

      {/* Channel + steps bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Channel toggle */}
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
          {([
            { id: 'whatsapp' as Channel, l: '📱 וואטסאפ', c: C.teal },
            { id: 'email' as Channel, l: '📧 מייל', c: C.accent },
          ] as const).map(t => (
            <div
              key={t.id}
              onClick={() => { setChannel(t.id); setSelTpl(null); }}
              style={{ padding: '7px 18px', fontSize: 13, fontWeight: channel === t.id ? 600 : 400, color: channel === t.id ? t.c : C.textSub, background: channel === t.id ? C.surface : 'transparent', cursor: 'pointer' }}
            >
              {t.l}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Steps step={step} onGoTo={setStep} />
      </div>

      {/* ── Step 0: audience ── */}
      {step === 0 && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>בחר רשימת נמענים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {audiences.map(l => (
              <div
                key={l.id}
                onClick={() => setSelList(l)}
                style={{ background: C.surface, border: `2px solid ${selList?.id === l.id ? C.accent : C.border}`, borderRadius: 9, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>{l.desc}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 48 }}>
                  {loadingCounts ? (
                    <div style={{ fontSize: 11, color: C.textDim }}>טוען...</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{l.count ?? '—'}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>נמענים</div>
                    </>
                  )}
                </div>
                {selList?.id === l.id && <span style={{ color: C.accent, fontSize: 18, fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>
          <button
            disabled={!selList}
            onClick={() => setStep(1)}
            style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: selList ? C.accent : C.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: selList ? 'pointer' : 'not-allowed', opacity: selList ? 1 : 0.5 }}
          >
            הבא — בחר הודעה →
          </button>
        </div>
      )}

      {/* ── Step 1: template ── */}
      {step === 1 && (
        <div style={{ maxWidth: 580 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>בחר תבנית הודעה</div>
          {templates.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: C.textSub, fontSize: 13, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9 }}>
              אין תבניות לערוץ זה. צור תבניות בעורך ההודעות.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelTpl(t)}
                  style={{ background: C.surface, border: `2px solid ${selTpl?.id === t.id ? C.accent : C.border}`, borderRadius: 9, padding: '12px 15px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <StageBadge stage={t.stage} />
                      {selTpl?.id === t.id && <span style={{ color: C.accent, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.body.slice(0, 100)}{t.body.length > 100 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(0)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: C.text }}>
              ← חזור
            </button>
            <button
              disabled={!selTpl}
              onClick={() => setStep(2)}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: selTpl ? C.accent : C.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: selTpl ? 'pointer' : 'not-allowed', opacity: selTpl ? 1 : 0.5 }}
            >
              הבא — אישור →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: confirm / sent ── */}
      {step === 2 && (
        <div style={{ maxWidth: 480 }}>
          {!sent ? (
            <>
              {/* Banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.aiBg, border: `1px solid ${C.ai}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: C.ai, flex: 1 }}>
                  עומד לשלוח <b>{channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'}</b> ל-<b>{selList?.count ?? '?'} נמענים</b>
                </span>
              </div>

              {/* Summary card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
                {([
                  ['ערוץ', channel === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'],
                  ['רשימה', `${selList?.name} (${selList?.count ?? '?'})`],
                  ['תבנית', selTpl?.name ?? '—'],
                  ['שליחה', 'מיידית'],
                ] as const).map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < 3 ? `1px solid ${C.borderLight}` : 'none' }}>
                    <span style={{ width: 70, fontSize: 12, color: C.textSub, fontWeight: 500 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Message preview */}
              <div style={{ padding: '12px 14px', borderRadius: 9, background: channel === 'whatsapp' ? '#E9FBD8' : C.accentBg, marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap' }}>
                {selTpl?.body.replace(/\[שם\]/g, '[שם הנמען]')}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: C.text }}>
                  ← חזור
                </button>
                <button
                  onClick={doSend}
                  disabled={sending}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                >
                  {sending ? '⟳ שולח...' : '📤 שלח עכשיו'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>נשלח בהצלחה!</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 24 }}>
                {selList?.count} הודעות נשלחו לרשימה "{selList?.name}"
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 22, maxWidth: 320, margin: '0 auto 22px' }}>
                {([
                  ['נשלחו', selList?.count ?? 0, C.success],
                  ['נפתחו', '—', C.accent],
                  ['שגיאות', '0', C.gray],
                ] as const).map(([l, v, c], i) => (
                  <div key={i} style={{ padding: '10px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textSub }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={reset} style={{ padding: '7px 22px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                שליחה חדשה
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
