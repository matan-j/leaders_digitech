import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMPipeline() {
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
