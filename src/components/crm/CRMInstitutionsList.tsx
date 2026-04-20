import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
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

const TEMPLATE_FIELDS = ['שם מוסד', 'עיר', 'סוג', 'איש קשר', 'תפקיד', 'טלפון', 'אימייל'] as const;
const REQUIRED_FIELDS: (typeof TEMPLATE_FIELDS[number])[] = ['שם מוסד', 'עיר'];

interface CsvRow {
  'שם מוסד': string;
  'עיר': string;
  'סוג': string;
  'איש קשר': string;
  'תפקיד': string;
  'טלפון': string;
  'אימייל': string;
  _invalid?: boolean;
}

interface ImportResult {
  imported: number;
  autoAssigned: number;
  errors: number;
}

interface CsvModalProps {
  onClose: () => void;
  onImportDone: () => void;
}

const CsvModal = ({ onClose, onImportDone }: CsvModalProps) => {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t'],
      encoding: 'UTF-8',
      complete: (result) => {
        const rows: CsvRow[] = result.data.map((r) => {
          // Normalize BOM-stripped header keys
          const norm: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            norm[k.replace(/^\uFEFF/, '').trim()] = (v ?? '').trim();
          }
          const row: CsvRow = {
            'שם מוסד': norm['שם מוסד'] ?? '',
            'עיר':     norm['עיר'] ?? '',
            'סוג':     norm['סוג'] ?? '',
            'איש קשר': norm['איש קשר'] ?? '',
            'תפקיד':   norm['תפקיד'] ?? '',
            'טלפון':   norm['טלפון'] ?? '',
            'אימייל':  norm['אימייל'] ?? '',
          };
          row._invalid = REQUIRED_FIELDS.some((f) => !row[f]);
          return row;
        });
        setCsvRows(rows);
        setStep(1);
      },
    });
  };

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt|xlsx?)$/i)) return;
    parseFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const header = TEMPLATE_FIELDS.join(',');
    const example = 'בית ספר לדוגמה,תל אביב,תיכון,ישראל ישראלי,מנהל,050-1234567,example@school.co.il';
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'institutions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    const validRows = csvRows.filter((r) => !r._invalid);
    if (validRows.length === 0) return;

    setImporting(true);
    setStep(2);

    // Fetch instructors for city-matching
    const { data: instructors } = await supabase
      .from('profiles')
      .select('id, city')
      .eq('role', 'instructor');

    let imported = 0;
    let autoAssigned = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        const { data: inst, error: instErr } = await supabase
          .from('educational_institutions')
          .insert({ name: row['שם מוסד'], city: row['עיר'] || null })
          .select('id')
          .single();

        if (instErr || !inst) { errors++; continue; }

        // Auto-assign instructor by city
        if (instructors && row['עיר']) {
          const match = instructors.find(
            (i: { id: string; city: string | null }) => i.city?.trim() === row['עיר'].trim()
          );
          if (match) {
            await supabase
              .from('educational_institutions')
              .update({ crm_assigned_instructor_id: match.id })
              .eq('id', inst.id);
            autoAssigned++;
          }
        }

        // Insert contact if name provided
        if (row['איש קשר']) {
          await supabase.from('crm_contacts').insert({
            institution_id: inst.id,
            name: row['איש קשר'],
            role: row['תפקיד'] || null,
            phone: row['טלפון'] || null,
            email: row['אימייל'] || null,
            is_primary: true,
          });
        }

        imported++;
      } catch {
        errors++;
      }
    }

    setResult({ imported, autoAssigned, errors });
    setImporting(false);
    setStep(3);
  };

  const validCount = csvRows.filter((r) => !r._invalid).length;
  const invalidCount = csvRows.length - validCount;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 12, width: 620, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">

        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📤 ייבוא מוסדות מ-CSV</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', padding: '10px 22px', gap: 6, borderBottom: `1px solid ${C.border}` }}>
          {(['העלאה', 'תצוגה מקדימה', 'ייבוא', 'סיום'] as const).map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: step >= i ? 1 : 0.35 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: step > i ? C.success : step === i ? C.accent : C.border, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {step > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: step === i ? 700 : 400, color: step === i ? C.text : C.textSub }}>{label}</span>
              {i < 3 && <span style={{ color: C.border, fontSize: 12 }}>›</span>}
            </div>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>

          {/* Step 0 — Upload */}
          {step === 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.aiBg, border: `1px solid ${C.ai}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: C.ai, flex: 1 }}>ייבוא מהיר ממסמך CSV — כולל שיוך מדריך אוטומטי לפי עיר.</span>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 10, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? C.accentBg : C.bg, marginBottom: 14, transition: 'all 0.15s' }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>גרור קובץ CSV לכאן</div>
                <div style={{ fontSize: 12, color: C.textSub }}>או לחץ לבחירת קובץ (.csv, .xlsx)</div>
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" style={{ display: 'none' }} onChange={handleInputChange} />
              </div>
              <div style={{ background: C.bg, borderRadius: 8, padding: '10px 13px', fontFamily: 'monospace', fontSize: 12, color: C.textSub, lineHeight: 1.8, marginBottom: 12 }}>
                {TEMPLATE_FIELDS.join(', ')}<br />
                בית ספר לדוגמה, תל אביב, תיכון, ישראל ישראלי, מנהל, 050-1234567, example@school.co.il
              </div>
              <button onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 12, padding: '5px 11px', background: C.surface, color: C.text }}>
                ⬇ הורד תבנית
              </button>
            </>
          )}

          {/* Step 1 — Preview */}
          {step === 1 && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, padding: '9px 14px', background: C.successBg, border: `1px solid ${C.success}20`, borderRadius: 8, fontSize: 13, color: C.success, fontWeight: 600 }}>
                  ✓ {validCount} שורות תקינות
                </div>
                {invalidCount > 0 && (
                  <div style={{ padding: '9px 14px', background: C.dangerBg, border: `1px solid ${C.danger}20`, borderRadius: 8, fontSize: 13, color: C.danger, fontWeight: 600 }}>
                    ⚠ {invalidCount} שורות חסרות שדות חובה
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.textSub, marginBottom: 8 }}>
                מציג {Math.min(csvRows.length, 5)} מתוך {csvRows.length} שורות · שדות חובה: שם מוסד, עיר
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 260 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {TEMPLATE_FIELDS.map((h) => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                            {h}{REQUIRED_FIELDS.includes(h as typeof REQUIRED_FIELDS[number]) ? ' *' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: row._invalid ? C.dangerBg : undefined }}>
                          {TEMPLATE_FIELDS.map((f) => (
                            <td key={f} style={{ padding: '6px 10px', fontSize: 12, color: (REQUIRED_FIELDS.includes(f as typeof REQUIRED_FIELDS[number]) && !row[f]) ? C.danger : C.text }}>
                              {row[f] || <span style={{ color: C.textDim }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {csvRows.length > 5 && (
                <div style={{ fontSize: 11, color: C.textSub, marginTop: 8, textAlign: 'center' }}>
                  + {csvRows.length - 5} שורות נוספות
                </div>
              )}
            </>
          )}

          {/* Step 2 — Importing spinner */}
          {step === 2 && importing && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>מייבא מוסדות...</div>
              <div style={{ fontSize: 12, color: C.textSub }}>אנא המתן, מבצע שיוך מדריכים אוטומטי לפי עיר</div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && result && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>הייבוא הושלם!</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, margin: '0 auto 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: C.successBg, borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: C.success, fontWeight: 600 }}>מוסדות נוספו</span>
                  <span style={{ color: C.success, fontWeight: 700 }}>{result.imported}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: C.accentBg, borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: C.accent, fontWeight: 600 }}>שויכו למדריכים אוטומטית</span>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{result.autoAssigned}</span>
                </div>
                {result.errors > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: C.dangerBg, borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: C.danger, fontWeight: 600 }}>שגיאות</span>
                    <span style={{ color: C.danger, fontWeight: 700 }}>{result.errors}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { onImportDone(); onClose(); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 13, padding: '9px 22px', background: C.accent, color: '#fff' }}
              >
                סגור ורענן רשימה
              </button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {step === 1 && (
          <div style={{ padding: '13px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
            <button
              onClick={runImport}
              disabled={validCount === 0}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: validCount > 0 ? 'pointer' : 'not-allowed', border: 'none', fontSize: 13, padding: '8px 14px', background: validCount > 0 ? C.accent : C.border, color: '#fff', opacity: validCount > 0 ? 1 : 0.6 }}
            >
              ✓ ייבא {validCount} מוסדות
            </button>
            <button
              onClick={() => { setStep(0); setCsvRows([]); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 13, padding: '8px 14px', background: C.surface, color: C.text }}
            >
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
  mode: 'leads' | 'customers';
}

const CRMInstitutionsList = ({ setTab: _setTab, mode }: Props) => {
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
  const fetchInstitutions = useCallback(async () => {
    setLoading(true);
    let query = supabase
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

    if (mode === 'leads') {
      query = query.or('crm_class.eq.Lead,crm_class.is.null');
    } else {
      query = query.eq('crm_class', 'Customer');
    }

    const { data, error } = await query;

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
  }, [mode]);

  useEffect(() => { fetchInstitutions(); }, [fetchInstitutions]);

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
      {showCsv && <CsvModal onClose={() => setShowCsv(false)} onImportDone={fetchInstitutions} />}
      {assignTarget && (
        <AssignInstructorModal
          institutionId={assignTarget.id}
          institutionName={assignTarget.name}
          institutionCity={assignTarget.city}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
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
                {['מוסד', 'עיר', 'סיווג', 'שלב', 'איש קשר', mode === 'leads' ? 'מדריך מוכר' : 'מדריך לתכנית', 'קשר אחרון', 'פעולה הבאה', 'הזדמנות'].map((h) => (
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
                    onClick={() => navigate(`/crm/institution/${row.id}`)}
                  >
                    {/* Institution name */}
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{row.name}</div>
                    </td>

                    {/* City */}
                    <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }}>
                      {row.city ?? '—'}
                    </td>

                    {/* Classification */}
                    <td style={{ padding: '9px 12px' }}>
                      {row.crm_class ? classBadge(row.crm_class) : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                    </td>

                    {/* Stage */}
                    <td style={{ padding: '9px 12px' }}>
                      {row.crm_stage ? stageBadge(row.crm_stage) : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                    </td>

                    {/* Primary contact */}
                    <td style={{ padding: '9px 12px' }}>
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
                    <td style={{ padding: '9px 12px', fontSize: 12, color: C.textSub }}>
                      {formatLastContact(row.crm_last_contact_at)}
                    </td>

                    {/* Next step */}
                    <td style={{ padding: '9px 12px' }}>
                      {row.crm_next_step ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.accentBg, color: C.accent }}>
                          {row.crm_next_step}
                        </span>
                      ) : (
                        <span style={{ color: C.textDim, fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Open opportunity / potential */}
                    <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: C.success }}>
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
          {mode === 'leads' && unassignedCount > 0 && <span style={{ color: C.warning, fontWeight: 600 }}>{unassignedCount} ללא מדריך</span>}
        </div>
      </div>
    </div>
  );
};

export default CRMInstitutionsList;
