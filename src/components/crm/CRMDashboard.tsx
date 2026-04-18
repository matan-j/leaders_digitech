import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { callCrmAI } from '@/hooks/useCrmAI';
import type { CRMTab } from '@/pages/CRM';

const C = {
  bg: '#F8F9FB',
  surface: '#FFFFFF',
  border: '#E4E7ED',
  text: '#111827',
  textSub: '#6B7280',
  textDim: '#9CA3AF',
  accent: '#3B5BDB',
  accentBg: '#EEF2FF',
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  purple: '#7C3AED',
  purpleBg: '#EDE9FE',
  teal: '#0891B2',
  tealBg: '#CFFAFE',
  ai: '#0EA5E9',
  aiBg: '#E0F2FE',
};

// ── shared mini-components ────────────────────────────────────

const Av = ({ name, size = 28 }: { name: string; size?: number }) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%',
      background: C.accentBg, color: C.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size / 2.6, fontWeight: 700, flexShrink: 0,
    }}
  >
    {(name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

const stageBadge = (s: string) => {
  const m: Record<string, [string, string]> = {
    'יצירת קשר': [C.textSub, C.bg],
    'מעוניין':   [C.accent,  C.accentBg],
    'סגירה':     [C.warning, C.warningBg],
    'זכה':       [C.success, C.successBg],
    'הפסיד':     [C.danger,  C.dangerBg],
  };
  const [color, bg] = m[s] || [C.textSub, C.bg];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: bg, color,
    }}>
      {s}
    </span>
  );
};

// ── KPI types ────────────────────────────────────────────────

interface KPIs {
  newLeads: number;
  inProgress: number;
  activeCustomers: number;
  openPotential: number;
  openOpportunities: number;
  overdueFollowups: number;
}

interface HotLead {
  id: string;
  name: string;
  crm_stage: string | null;
  crm_potential: number | null;
  crm_last_contact_at: string | null;
  crm_owner_id: string | null;
  instructor: { full_name: string } | null;
}

// ── AI section types ──────────────────────────────────────────

interface AISection {
  title: string;
  body: string;
}

// ── StatPill ──────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  onClick?: () => void;
}

const StatPill = ({ label, value, color, bg, onClick }: StatPillProps) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 9,
      cursor: onClick ? 'pointer' : 'default', gap: 12,
    }}
  >
    <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>{label}</span>
    <span style={{
      fontSize: 16, fontWeight: 800, color, background: bg,
      padding: '2px 10px', borderRadius: 20,
    }}>
      {value}
    </span>
  </div>
);

// ── main component ────────────────────────────────────────────

interface Props {
  setTab: (tab: CRMTab) => void;
}

const SECTION_ICONS: Record<string, string> = {
  'מי צפוי להיסגר': '🎯',
  'מי תקוע': '🔴',
  'לחידוש דחוף': '♻️',
  'המלצה לעכשיו': '⚡',
};

const SECTION_COLORS: Record<string, [string, string]> = {
  'מי צפוי להיסגר': [C.success, C.successBg],
  'מי תקוע':        [C.danger,  C.dangerBg],
  'לחידוש דחוף':   [C.purple,  C.purpleBg],
  'המלצה לעכשיו':  [C.ai,      C.aiBg],
};

const CRMDashboard = ({ setTab }: Props) => {
  const [kpis, setKpis] = useState<KPIs>({
    newLeads: 0, inProgress: 0, activeCustomers: 0,
    openPotential: 0, openOpportunities: 0, overdueFollowups: 0,
  });
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSections, setAiSections] = useState<AISection[] | null>(null);

  // ── fetch KPIs ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingKpis(true);
      try {
        const [instRes, oppRes, followRes] = await Promise.all([
          supabase
            .from('educational_institutions')
            .select('crm_class, crm_stage'),
          supabase
            .from('crm_opportunities')
            .select('status, value')
            .eq('status', 'open'),
          supabase
            .from('crm_followups')
            .select('due_date, status')
            .eq('status', 'pending'),
        ]);

        const insts = instRes.data ?? [];
        const opps = oppRes.data ?? [];
        const followups = followRes.data ?? [];

        const today = new Date().toISOString().split('T')[0];
        const overdue = followups.filter(
          (f) => f.due_date && f.due_date < today,
        ).length;

        const totalPotential = opps.reduce(
          (sum, o) => sum + (o.value ? Number(o.value) : 0),
          0,
        );

        setKpis({
          newLeads: insts.filter((i) => i.crm_class === 'Lead' && i.crm_stage === 'יצירת קשר').length,
          inProgress: insts.filter((i) => i.crm_stage && !['זכה', 'הפסיד'].includes(i.crm_stage)).length,
          activeCustomers: insts.filter((i) => i.crm_class === 'Customer').length,
          openPotential: Math.round(totalPotential / 1000),
          openOpportunities: opps.length,
          overdueFollowups: overdue,
        });
      } catch (_) {
        // silently fail — KPIs show 0
      }
      setLoadingKpis(false);
    };
    load();
  }, []);

  // ── fetch hot leads ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('educational_institutions')
        .select(`
          id, name, crm_stage, crm_potential, crm_last_contact_at, crm_owner_id,
          instructor:crm_assigned_instructor_id (full_name)
        `)
        .eq('crm_class', 'Lead')
        .not('crm_stage', 'is', null)
        .order('crm_last_contact_at', { ascending: false })
        .limit(4);

      if (data) {
        setHotLeads(
          data.map((d: any) => ({
            ...d,
            instructor: Array.isArray(d.instructor) ? d.instructor[0] ?? null : d.instructor,
          })),
        );
      }
    };
    load();
  }, []);

  // ── AI summary ───────────────────────────────────────────────
  const loadAI = async () => {
    setAiLoading(true);
    setAiSections(null);
    try {
      const raw = await callCrmAI('daily_summary', {
        stats: {
          newLeads: kpis.newLeads,
          inProgress: kpis.inProgress,
          activeCustomers: kpis.activeCustomers,
          openOpportunities: kpis.openOpportunities,
          overdueFollowups: kpis.overdueFollowups,
        },
        hotLeads: hotLeads.map((h) => ({
          name: h.name,
          stage: h.crm_stage,
          potential: h.crm_potential,
          lastContact: h.crm_last_contact_at,
        })),
      });

      // Edge function returns JSON: { closing_soon, stuck, renewal, recommendation }
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(raw) as Record<string, string>;
      } catch {
        // Fallback: treat raw text as single section
        setAiSections([{ title: 'סיכום', body: raw }]);
        setAiLoading(false);
        return;
      }

      const mapping: [string, string][] = [
        ['מי צפוי להיסגר', parsed['closing_soon'] ?? '—'],
        ['מי תקוע',        parsed['stuck']         ?? '—'],
        ['לחידוש דחוף',   parsed['renewal']        ?? '—'],
        ['המלצה לעכשיו',  parsed['recommendation'] ?? '—'],
      ];
      setAiSections(mapping.map(([title, body]) => ({ title, body })));
    } catch (_) {
      setAiSections([{ title: 'שגיאה', body: 'לא ניתן לטעון. בדוק חיבור.' }]);
    }
    setAiLoading(false);
  };

  const formatLastContact = (iso: string | null) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return 'היום';
    if (diff === 1) return 'אתמול';
    return `${diff}י׳`;
  };

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto' }}>
      {/* Overdue alert */}
      {kpis.overdueFollowups > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', background: C.dangerBg,
          border: `1px solid ${C.danger}20`, borderRadius: 8,
          marginBottom: 18, fontSize: 13,
        }}>
          <span style={{ color: C.danger }}>⚠️</span>
          <span style={{ color: C.danger, flex: 1 }}>
            <b>{kpis.overdueFollowups} פעולות מעקב באיחור</b>
          </span>
          <span
            onClick={() => setTab('followup')}
            style={{ color: C.danger, textDecoration: 'underline', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            לתור מעקב →
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* LEFT: KPIs + quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
            סטטוס פייפליין
          </div>
          <StatPill label="לידים חדשים"      value={loadingKpis ? '...' : kpis.newLeads}        color={C.accent}  bg={C.accentBg}  onClick={() => setTab('list')} />
          <StatPill label="בתהליך"            value={loadingKpis ? '...' : kpis.inProgress}      color={C.warning} bg={C.warningBg} onClick={() => setTab('pipeline')} />
          <StatPill label="לקוחות פעילים"    value={loadingKpis ? '...' : kpis.activeCustomers} color={C.success} bg={C.successBg} onClick={() => setTab('list')} />
          <StatPill label="פוטנציאל פתוח"    value={loadingKpis ? '...' : `₪${kpis.openPotential}K`} color={C.purple} bg={C.purpleBg} onClick={() => setTab('pipeline')} />
          <StatPill label="הזדמנויות פתוחות" value={loadingKpis ? '...' : kpis.openOpportunities} color={C.teal}  bg={C.tealBg}   onClick={() => setTab('pipeline')} />

          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 6, marginBottom: 2 }}>
            פעולות מהירות
          </div>
          {([
            { label: '📤 ייבוא CSV',         tab: 'list'      },
            { label: '💬 עורך הודעות',        tab: 'messages'  },
            { label: '📢 שליחה בקבוצות',      tab: 'broadcast' },
            { label: '⏰ תור מעקב',           tab: 'followup'  },
          ] as { label: string; tab: CRMTab }[]).map((a) => (
            <button
              key={a.tab}
              onClick={() => setTab(a.tab)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${C.border}`, fontSize: 12,
                padding: '5px 11px', background: C.surface, color: C.text,
                justifyContent: 'flex-start', width: '100%',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* CENTER: hot leads */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            🔥 לידים חמים
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hotLeads.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textDim, padding: '20px 0' }}>אין לידים עדיין</div>
            ) : hotLeads.map((h) => (
              <div
                key={h.id}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '11px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.surface)}
              >
                <Av name={h.name} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: C.textSub }}>
                    {h.instructor ? `👤 ${h.instructor.full_name} · ` : ''}
                    {formatLastContact(h.crm_last_contact_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  {h.crm_stage && stageBadge(h.crm_stage)}
                  {h.crm_potential != null && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.success, marginTop: 4, textAlign: 'right' }}>
                      ₪{Number(h.crm_potential).toLocaleString('he-IL')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => setTab('pipeline')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${C.border}`, fontSize: 12,
                padding: '5px 11px', background: 'transparent', color: C.textSub,
              }}
            >
              כל הפייפליין →
            </button>
          </div>
        </div>

        {/* RIGHT: AI summary */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            🤖 סיכום AI להיום
          </div>
          <div style={{
            background: C.surface, border: `1px solid ${C.ai}25`,
            borderRadius: 10, padding: '14px 16px',
            borderTop: `3px solid ${C.ai}`, minHeight: 320,
            display: 'flex', flexDirection: 'column',
          }}>
            {!aiSections && !aiLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 0' }}>
                <div style={{ fontSize: 28 }}>🤖</div>
                <div style={{ fontSize: 12, color: C.textSub, textAlign: 'center', lineHeight: 1.6 }}>
                  קבל סיכום חכם של הפייפליין — מי ייסגר, מי תקוע, ומה לעשות עכשיו
                </div>
                <button
                  onClick={loadAI}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${C.ai}30`, fontSize: 12,
                    padding: '5px 11px', background: C.aiBg, color: C.ai,
                  }}
                >
                  ✨ הפעל סיכום
                </button>
              </div>
            )}

            {aiLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ fontSize: 22, color: C.ai }}>⟳</div>
                <div style={{ fontSize: 12, color: C.ai }}>מנתח את הפייפליין...</div>
              </div>
            )}

            {aiSections && !aiLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {aiSections.map((sec, i) => {
                  const [col, bg] = SECTION_COLORS[sec.title] ?? [C.ai, C.aiBg];
                  return (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: bg, border: `1px solid ${col}15` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: col, marginBottom: 4 }}>
                        {SECTION_ICONS[sec.title] ?? '•'} {sec.title}
                      </div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55 }}>{sec.body}</div>
                    </div>
                  );
                })}
                <button
                  onClick={loadAI}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${C.ai}30`, fontSize: 12,
                    padding: '5px 11px', background: C.aiBg, color: C.ai,
                    marginTop: 'auto',
                  }}
                >
                  ⟳ רענן
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CRMDashboard;
