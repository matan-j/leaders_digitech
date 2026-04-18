import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AssignInstructorModal from './AssignInstructorModal';
import type { CRMTab } from '@/pages/CRM';

const C = {
  bg: '#F8F9FB',
  surface: '#FFFFFF',
  border: '#E4E7ED',
  borderLight: '#F0F2F5',
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
  ai: '#0EA5E9',
  aiBg: '#E0F2FE',
};

const STAGES = ['יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד'] as const;
const CLASSES = ['Lead', 'Customer', 'Past Customer'] as const;

// ── badge helpers ─────────────────────────────────────────────

const classBadge = (c: string) => {
  const m: Record<string, [string, string]> = {
    Lead:            [C.warning, C.warningBg],
    Customer:        [C.success, C.successBg],
    'Past Customer': [C.textSub, C.bg],
  };
  const [color, bg] = m[c] ?? [C.textSub, C.bg];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {c}
    </span>
  );
};

const stageBadge = (s: string) => {
  const m: Record<string, [string, string]> = {
    'יצירת קשר': [C.textSub, C.bg],
    'מעוניין':   [C.accent,  C.accentBg],
    'סגירה':     [C.warning, C.warningBg],
    'זכה':       [C.success, C.successBg],
    'הפסיד':     [C.danger,  C.dangerBg],
  };
  const [color, bg] = m[s] ?? [C.textSub, C.bg];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {s}
    </span>
  );
};

const Av = ({ name, size = 22, color = C.accent, bg = C.accentBg }: { name: string; size?: number; color?: string; bg?: string }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.6, fontWeight: 700, flexShrink: 0 }}>
    {(name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

// ── types ────────────────────────────────────────────────────

interface CRMContact {
  id: string;
  name: string;
  role: string | null;
  is_primary: boolean | null;
}

interface InstitutionRow {
  id: string;
  name: string;
  city: string | null;
  crm_class: string | null;
  crm_stage: string | null;
  crm_last_contact_at: string | null;
  crm_next_step: string | null;
  crm_next_step_date: string | null;
  crm_owner_id: string | null;
  crm_assigned_instructor_id: string | null;
  crm_potential: number | null;
  instructor: { id: string; full_name: string } | null;
  contacts: CRMContact[];
}

// ── CSV modal ────────────────────────────────────────────────

interface CsvModalProps {
  onClose: () => void;
}

const CsvModal = ({ onClose }: CsvModalProps) => {
  const [step, setStep] = useState(0);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;
      const header = lines[0].split(',').map((s) => s.trim());
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(',').map((s) => s.trim());
        const obj: Record<string, string> = {};
        header.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
      }).filter((r) => Object.values(r).some((v) => v));
      setCsvRows(parsed);
      setStep(1);
    };
    reader.readAsText(file, 'utf-8');
  };

  const downloadTemplate = () => {
    const content = 'שם מוסד,עיר,סוג,איש קשר,טלפון,אימייל\nדוגמה,תל אביב,עירייה,שם,054-0000000,ex@org.il';
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(content);
    a.download = 'template.csv';
    a.click();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 12, width: 560, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📤 ייבוא מוסדות מ-CSV</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
          {step === 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.aiBg, border: `1px solid ${C.ai}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: C.ai, flex: 1 }}>ייבוא מהיר ממסמך אקסל / CSV — כולל שיוך מדריך אוטומטי לפי עיר.</span>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: C.bg, marginBottom: 14 }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>גרור קובץ CSV לכאן</div>
                <div style={{ fontSize: 12, color: C.textSub }}>או לחץ לבחירת קובץ</div>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
              </div>
              <div style={{ background: C.bg, borderRadius: 8, padding: '10px 13px', fontFamily: 'monospace', fontSize: 12, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                שם מוסד, עיר, סוג, איש קשר, טלפון, אימייל<br />
                עיריית נתניה, נתניה, עירייה, דנה לוי, 054-111, dana@net.il
              </div>
              <button onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 12, padding: '5px 11px', background: C.surface, color: C.text }}>
                ⬇ הורד תבנית
              </button>
            </>
          )}
          {step === 1 && !done && csvRows.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.successBg, border: `1px solid ${C.success}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: C.success, flex: 1 }}>✓ נמצאו <b>{csvRows.length} מוסדות</b></span>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {Object.keys(csvRows[0] ?? {}).map((h) => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} style={{ padding: '6px 10px', fontSize: 12 }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {done && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>הייבוא הושלם!</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 18 }}>{csvRows.length} מוסדות נוספו · שיוך מדריכים אוטומטי בוצע לפי עיר</div>
              <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 13, padding: '7px 14px', background: C.accent, color: '#fff' }}>סגור</button>
            </div>
          )}
        </div>
        {step === 1 && !done && (
          <div style={{ padding: '13px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
            <button onClick={() => setDone(true)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 13, padding: '7px 14px', background: C.accent, color: '#fff' }}>
              ✓ ייבא {csvRows.length} מוסדות
            </button>
            <button onClick={() => setStep(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 13, padding: '7px 14px', background: C.surface, color: C.text }}>
              חזור
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────

interface Props {
  setTab: (tab: CRMTab) => void;
}

const CRMInstitutionsList = ({ setTab: _setTab }: Props) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCsv, setShowCsv] = useState(false);
  const [assignTarget, setAssignTarget] = useState<InstitutionRow | null>(null);

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('הכל');
  const [filterStage, setFilterStage] = useState('הכל');
  const [filterCity, setFilterCity] = useState('הכל');
  const [filterInstructor, setFilterInstructor] = useState('הכל');

  // ── load data ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('educational_institutions')
        .select(`
          id, name, city,
          crm_class, crm_stage, crm_last_contact_at, crm_next_step, crm_next_step_date,
          crm_owner_id, crm_assigned_instructor_id,
          crm_potential,
          instructor:crm_assigned_instructor_id (id, full_name),
          contacts:crm_contacts (id, name, role, is_primary)
        `)
        .order('name');

      if (!error && data) {
        setRows(
          data.map((d: any) => ({
            ...d,
            instructor: Array.isArray(d.instructor) ? d.instructor[0] ?? null : d.instructor,
            contacts: Array.isArray(d.contacts) ? d.contacts : [],
          })),
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── derived filter options ───────────────────────────────────
  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))] as string[];
  const instructorNames = [...new Set(
    rows.map((r) => r.instructor?.full_name).filter(Boolean),
  )] as string[];

  // ── filtering ────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    if (search && !r.name.includes(search) && !(r.city ?? '').includes(search)) return false;
    if (filterClass !== 'הכל' && r.crm_class !== filterClass) return false;
    if (filterStage !== 'הכל' && r.crm_stage !== filterStage) return false;
    if (filterCity !== 'הכל' && r.city !== filterCity) return false;
    if (filterInstructor === 'לא משויך' && r.instructor) return false;
    if (filterInstructor !== 'הכל' && filterInstructor !== 'לא משויך' && r.instructor?.full_name !== filterInstructor) return false;
    return true;
  });

  const unassignedCount = rows.filter((r) => !r.instructor).length;
  const hasActiveFilters = filterClass !== 'הכל' || filterStage !== 'הכל' || filterCity !== 'הכל' || filterInstructor !== 'הכל';

  const clearFilters = () => {
    setFilterClass('הכל');
    setFilterStage('הכל');
    setFilterCity('הכל');
    setFilterInstructor('הכל');
  };

  const formatLastContact = (iso: string | null) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return 'היום';
    if (diff === 1) return 'אתמול';
    return `${diff}י׳`;
  };

  const primaryContact = (row: InstitutionRow) =>
    row.contacts.find((c) => c.is_primary) ?? row.contacts[0] ?? null;

  const filterSelectStyle = (active: boolean) => ({
    padding: '6px 10px', borderRadius: 6,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentBg : C.surface,
    color: active ? C.accent : C.textSub,
    fontSize: 12, cursor: 'pointer', outline: 'none',
    fontWeight: active ? 600 : 400,
  });

  // ── handle assign result ─────────────────────────────────────
  const handleAssigned = (instructorId: string, instructorName: string) => {
    if (!assignTarget) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === assignTarget.id
          ? { ...r, crm_assigned_instructor_id: instructorId, instructor: { id: instructorId, full_name: instructorName } }
          : r,
      ),
    );
    setAssignTarget(null);
  };

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto' }}>
      {showCsv && <CsvModal onClose={() => setShowCsv(false)} />}
      {assignTarget && (
        <AssignInstructorModal
          institutionId={assignTarget.id}
          institutionName={assignTarget.name}
          institutionCity={assignTarget.city}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}

      {/* Unassigned banner */}
      {unassignedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.warningBg, border: `1px solid ${C.warning}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: C.warning, flex: 1 }}>
            ⚠️ <b>{unassignedCount} לידים</b> ללא מדריך משויך —{' '}
            <span onClick={() => setFilterInstructor('לא משויך')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>הצג אותם</span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  חיפוש לפי שם / עיר..."
          style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, width: 210, outline: 'none', color: C.text }}
        />
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={filterSelectStyle(filterClass !== 'הכל')}>
          {['הכל', ...CLASSES].map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} style={filterSelectStyle(filterStage !== 'הכל')}>
          {['הכל', ...STAGES].map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={filterSelectStyle(filterCity !== 'הכל')}>
          {['הכל', ...cities].map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={filterInstructor} onChange={(e) => setFilterInstructor(e.target.value)} style={filterSelectStyle(filterInstructor !== 'הכל')}>
          {['הכל', 'לא משויך', ...instructorNames].map((o) => <option key={o}>{o}</option>)}
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.danger}30`, background: C.dangerBg, color: C.danger, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            ✕ נקה פילטרים
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCsv(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 12, padding: '5px 11px', background: C.surface, color: C.text }}>
          📤 ייבוא CSV
        </button>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12, padding: '5px 11px', background: C.accent, color: '#fff' }}>
          + הוסף מוסד
        </button>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>טוען...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['מוסד', 'עיר', 'סיווג', 'שלב', 'איש קשר', 'מדריך משויך', 'קשר אחרון', 'פעולה הבאה', 'הזדמנות'].map((h) => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>לא נמצאו מוסדות</td>
                </tr>
              ) : filtered.map((row) => {
                const contact = primaryContact(row);
                return (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                                     >
                    {/* Institution name */}
                    <td style={{ padding: '9px 12px' }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{row.name}</div>
                    </td>

                    {/* City */}
                    <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {row.city ?? '—'}
                    </td>

                    {/* Classification */}
                    <td style={{ padding: '9px 12px' }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {row.crm_class ? classBadge(row.crm_class) : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                    </td>

                    {/* Stage */}
                    <td style={{ padding: '9px 12px' }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {row.crm_stage ? stageBadge(row.crm_stage) : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                    </td>

                    {/* Primary contact */}
                    <td style={{ padding: '9px 12px' }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {contact ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Av name={contact.name} size={22} />
                          <span style={{ fontSize: 12 }}>{contact.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: C.textDim, fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Assigned instructor */}
                    <td style={{ padding: '9px 12px' }}>
                      {row.instructor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Av name={row.instructor.full_name} size={22} color={C.purple} bg={C.purpleBg} />
                          <span style={{ fontSize: 12, color: C.text }}>{row.instructor.full_name}</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAssignTarget(row); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px dashed ${C.warning}`, background: C.warningBg, color: C.warning, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        >
                          + שייך מדריך
                        </button>
                      )}
                    </td>

                    {/* Last contact */}
                    <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {formatLastContact(row.crm_last_contact_at)}
                    </td>

                    {/* Next step */}
                    <td style={{ padding: '9px 12px' }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {row.crm_next_step ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.accentBg, color: C.accent }}>
                          {row.crm_next_step}
                        </span>
                      ) : (
                        <span style={{ color: C.textDim, fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Open opportunity / potential */}
                    <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: C.success }} onClick={() => navigate(`/crm/institution/${row.id}`)}>
                      {row.crm_potential != null ? `₪${Number(row.crm_potential).toLocaleString('he-IL')}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ padding: '9px 16px', background: C.bg, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textSub, display: 'flex', justifyContent: 'space-between' }}>
          <span>מציג {filtered.length} מתוך {rows.length} מוסדות</span>
          {unassignedCount > 0 && <span style={{ color: C.warning, fontWeight: 600 }}>{unassignedCount} ללא מדריך</span>}
        </div>
      </div>
    </div>
  );
};

export default CRMInstitutionsList;
