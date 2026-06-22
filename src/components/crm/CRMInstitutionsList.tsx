import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Paperclip, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import AssignInstructorModal from './AssignInstructorModal';
import type { CRMTab } from '@/pages/CRM';
import { CRM_CUSTOMER_CLASS, CRM_LEAD_CLASS, CRM_SOFT_DELETE_FILTER } from '@/lib/crmQueryHelpers';
import { matchesLeadSearch } from '@/utils/leadSearch';

const C = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F0F2F5',
  text: '#111827',
  textSub: '#6B7280',
  textDim: '#9CA3AF',
  accent: '#6D28D9',
  accentBg: '#F3E8FF',
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

const CLASSES = ['Lead', 'Customer', 'Past Customer'] as const;

const Av = ({ name, size = 22, color = C.accent, bg = C.accentBg }: { name: string; size?: number; color?: string; bg?: string }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size / 2.6, fontWeight: 700, flexShrink: 0 }}>
    {(name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

// ── contact status helpers ────────────────────────────────────

const LEGACY_CONTACT_STATUS_FALLBACK: ContactStatus[] = [
  { id: 'legacy-high', key: 'not_contacted', label: 'לא שוחחנו', color: '#DC2626', order_index: 0, legacy_crm_risk: 'high' },
  { id: 'legacy-medium', key: 'in_progress', label: 'בתהליך', color: '#D97706', order_index: 1, legacy_crm_risk: 'medium' },
  { id: 'legacy-low', key: 'contacted', label: 'שוחחנו', color: '#16A34A', order_index: 2, legacy_crm_risk: 'low' },
];

const getContactStatus = (statuses: ContactStatus[], statusId: string | null, legacyRisk: string | null) => {
  const options = statuses.length > 0 ? statuses : LEGACY_CONTACT_STATUS_FALLBACK;
  return options.find((o) => o.id === statusId)
    ?? options.find((o) => o.legacy_crm_risk === legacyRisk)
    ?? options[0];
};

// ── types ────────────────────────────────────────────────────

interface CRMContact {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  is_primary: boolean | null;
}

interface ContactStatus {
  id: string;
  key: string;
  label: string;
  color: string;
  order_index: number;
  legacy_crm_risk: string | null;
}

type SchoolLevel = 'elementary' | 'secondary';

const SCHOOL_LEVEL_LABEL: Record<SchoolLevel, string> = {
  elementary: 'יסודי',
  secondary: 'על-יסודי',
};

const SCHOOL_LEVEL_PALETTE: Record<SchoolLevel, { color: string; bg: string }> = {
  elementary: { color: '#15803D', bg: '#DCFCE7' },
  secondary: { color: '#7C3AED', bg: '#EDE9FE' },
};

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
  crm_notes: string | null;
  crm_risk: string | null;
  crm_contact_status_id: string | null;
  contact_status: ContactStatus | null;
  has_files: boolean;
  school_level: SchoolLevel | null;
  instructor: { id: string; full_name: string } | null;
  contacts: CRMContact[];
  primaryPhone?: string | null;
}

interface PipelineStageOption {
  name: string;
}

type InstitutionPatch = Partial<Pick<InstitutionRow, 'city' | 'crm_stage' | 'crm_last_contact_at' | 'school_level'>>;
type ContactPatch = Partial<Pick<CRMContact, 'name' | 'role' | 'phone'>>;

// ── sort types ────────────────────────────────────────────────

type SortKey = 'city' | 'name' | 'crm_stage' | 'crm_last_contact_at';
type SortDir = 'asc' | 'desc';
type PersistedTableState = {
  search: string;
  filterClass: string;
  filterStage: string;
  filterCity: string;
  filterInstructor: string;
  filterSchoolLevel: string;
  filterContactStatus: string;
  sortKey: SortKey;
  sortDir: SortDir;
};

const TABLE_STATE_PREFIX = 'crmInstitutionsListState';
const SORT_KEYS: SortKey[] = ['city', 'name', 'crm_stage', 'crm_last_contact_at'];
const SORT_DIRS: SortDir[] = ['asc', 'desc'];

const defaultTableState: PersistedTableState = {
  search: '',
  filterClass: 'הכל',
  filterStage: 'הכל',
  filterCity: 'הכל',
  filterInstructor: 'הכל',
  filterSchoolLevel: 'הכל',
  filterContactStatus: 'הכל',
  sortKey: 'city',
  sortDir: 'asc',
};

const getStoredTableState = (mode: string): Partial<PersistedTableState> => {
  try {
    return JSON.parse(sessionStorage.getItem(`${TABLE_STATE_PREFIX}:${mode}`) ?? '{}');
  } catch {
    return {};
  }
};

const getPersistedTableState = (params: URLSearchParams, mode: string): PersistedTableState => {
  const stored = getStoredTableState(mode);
  const sortKey = params.get('sort') ?? stored.sortKey;
  const sortDir = params.get('dir') ?? stored.sortDir;

  return {
    search: params.get('q') ?? stored.search ?? defaultTableState.search,
    filterClass: params.get('class') ?? stored.filterClass ?? defaultTableState.filterClass,
    filterStage: params.get('stage') ?? stored.filterStage ?? defaultTableState.filterStage,
    filterCity: params.get('city') ?? stored.filterCity ?? defaultTableState.filterCity,
    filterInstructor: params.get('instructor') ?? stored.filterInstructor ?? defaultTableState.filterInstructor,
    filterSchoolLevel: params.get('level') ?? stored.filterSchoolLevel ?? defaultTableState.filterSchoolLevel,
    filterContactStatus: params.get('status') ?? stored.filterContactStatus ?? defaultTableState.filterContactStatus,
    sortKey: SORT_KEYS.includes(sortKey as SortKey) ? sortKey as SortKey : defaultTableState.sortKey,
    sortDir: SORT_DIRS.includes(sortDir as SortDir) ? sortDir as SortDir : defaultTableState.sortDir,
  };
};

const inlineControlStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 110,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  background: C.surface,
  color: C.text,
  fontSize: 12,
  padding: '4px 7px',
  outline: 'none',
};

interface InlineSelectCellProps {
  value: string | null;
  options: string[];
  placeholder?: string;
  onChange: (value: string | null) => void;
}

const InlineSelectCell = ({ value, options, placeholder = '—', onChange }: InlineSelectCellProps) => {
  const selectOptions = [
    ...options,
    ...(value && !options.includes(value) ? [value] : []),
  ];

  return (
    <select
      value={value ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value || null)}
      style={inlineControlStyle}
    >
      <option value="">{placeholder}</option>
      {selectOptions.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
};

interface InlineDateCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const toDateInputValue = (value: string | null) => {
  if (!value) return '';
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const InlineDateCell = ({ value, onChange }: InlineDateCellProps) => (
  <input
    type="date"
    value={toDateInputValue(value)}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => {
      const next = e.target.value;
      onChange(next ? `${next}T00:00:00.000Z` : null);
    }}
    style={inlineControlStyle}
  />
);

interface InlineTextCellProps {
  value: string | null;
  placeholder?: string;
  onSave: (value: string) => void;
  style?: React.CSSProperties;
}

const InlineTextCell = ({ value, placeholder = '—', onSave, style }: InlineTextCellProps) => {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    if (draft === (value ?? '')) return;
    onSave(draft);
  };

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setDraft(value ?? '');
          e.currentTarget.blur();
        }
      }}
      style={{ ...inlineControlStyle, ...style }}
    />
  );
};

// ── Notes Popover ─────────────────────────────────────────────

interface NotesPopoverProps {
  institutionId: string;
  notes: string | null;
  onSaved: (id: string, notes: string) => void;
}

const NotesPopover = ({ institutionId, notes, onSaved }: NotesPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  // Reset draft only when opening the popover, not on every notes prop change.
  // Having `notes` in deps would reset the user's in-progress edits whenever
  // the parent re-renders with a new notes value (e.g. immediately after onSaved
  // fires setRows while open is still true).
  useEffect(() => {
    if (!open) return;
    setDraft(notes ?? '');
    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 260;
      const height = popoverRef.current?.offsetHeight ?? 190;
      const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
      const opensDown = rect.bottom + 4 + height <= window.innerHeight - 8;
      const top = opensDown
        ? rect.bottom + 4
        : Math.max(8, rect.top - height - 4);
      setPopoverPosition({ top, left });
    };
    updatePosition();
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('educational_institutions')
      .update({ crm_notes: draft || null })
      .eq('id', institutionId);
    setSaving(false);
    onSaved(institutionId, draft);
    setOpen(false);
  };

  const preview = notes ? notes.slice(0, 40) + (notes.length > 40 ? '...' : '') : null;

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'relative', minWidth: 120 }}
    >
      {/* Trigger — fills the full cell area */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: 'pointer', fontSize: 12,
          color: preview ? C.text : C.textDim,
          padding: '4px 2px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {preview ?? <span style={{ fontSize: 11 }}>+ הוסף הערה</span>}
      </div>

      {open && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{
          position: 'fixed', top: popoverPosition.top, left: popoverPosition.left, zIndex: 1000,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)', padding: 12, width: 260, boxSizing: 'border-box',
        }}>
          {/* Popover header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub }}>הערות</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', fontSize: 14, color: C.textDim, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            >
              ✕
            </button>
          </div>

          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="הוסף הערות..."
            style={{ width: '100%', fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: C.text }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 7, width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 5, padding: '5px 0', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ── Risk Dropdown ─────────────────────────────────────────────

interface RiskDropdownProps {
  institutionId: string;
  statusId: string | null;
  legacyRisk: string | null;
  statuses: ContactStatus[];
  onChanged: (id: string, status: ContactStatus) => void;
}

const RiskDropdown = ({ institutionId, statusId, legacyRisk, statuses, onChanged }: RiskDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = statuses.length > 0 ? statuses : LEGACY_CONTACT_STATUS_FALLBACK;
  const current = getContactStatus(statuses, statusId, legacyRisk);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (status: ContactStatus) => {
    setOpen(false);
    onChanged(institutionId, status);
    await supabase
      .from('educational_institutions')
      .update({ crm_contact_status_id: status.id.startsWith('legacy-') ? null : status.id })
      .eq('id', institutionId);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref} onClick={(e) => e.stopPropagation()}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: current.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>{current.label}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 200,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)', overflow: 'hidden', minWidth: 120,
        }}>
          {options.map((o) => (
            <div
              key={o.id}
              onClick={() => handleSelect(o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
                fontSize: 12, cursor: 'pointer', color: C.text,
                background: o.id === current.id ? C.bg : undefined,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = o.id === current.id ? C.bg : '')}
            >
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: o.color }} />
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── School level dropdown ────────────────────────────────────

interface SchoolLevelDropdownProps {
  value: SchoolLevel | null;
  onChange: (value: SchoolLevel | null) => void;
}

const SCHOOL_LEVEL_OPTIONS: { value: SchoolLevel | null; label: string }[] = [
  { value: 'elementary', label: 'יסודי' },
  { value: 'secondary', label: 'על-יסודי' },
  { value: null, label: 'ללא סיווג' },
];

const SchoolLevelDropdown = ({ value, onChange }: SchoolLevelDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const palette = value ? SCHOOL_LEVEL_PALETTE[value] : { color: C.textDim, bg: C.surface };
  const label = value ? SCHOOL_LEVEL_LABEL[value] : '+ סוג';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (next: SchoolLevel | null) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 11px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: palette.bg,
          color: palette.color,
          border: `1px solid ${value ? palette.color + '33' : C.border}`,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 200,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)', overflow: 'hidden', minWidth: 130,
        }}>
          {SCHOOL_LEVEL_OPTIONS.map((opt) => {
            const isActive = opt.value === value;
            const optColor = opt.value ? SCHOOL_LEVEL_PALETTE[opt.value].color : C.textSub;
            return (
              <div
                key={opt.label}
                onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
                  fontSize: 12, cursor: 'pointer', color: C.text,
                  background: isActive ? C.bg : undefined,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = isActive ? C.bg : '')}
              >
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: optColor }} />
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  pipelineStageNames: string[];
}

const CsvModal = ({ onClose, onImportDone, pipelineStageNames }: CsvModalProps) => {
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
          const norm: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            norm[k.replace(/^﻿/, '').trim()] = (v ?? '').trim();
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
    const bom = '﻿';
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
    const defaultCrmStage = pipelineStageNames[0] ?? null;

    setImporting(true);
    setStep(2);

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
          .insert({ name: row['שם מוסד'], city: row['עיר'] || null, crm_class: CRM_LEAD_CLASS, crm_stage: defaultCrmStage })
          .select('id')
          .single();

        if (instErr || !inst) { errors++; continue; }

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

        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📤 ייבוא מוסדות מ-CSV</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>

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

          {step === 2 && importing && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>מייבא מוסדות...</div>
              <div style={{ fontSize: 12, color: C.textSub }}>אנא המתן, מבצע שיוך מדריכים אוטומטי לפי עיר</div>
            </div>
          )}

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

// ── AddInstitutionModal ───────────────────────────────────────

interface AddInstitutionModalProps {
  onClose: () => void;
  onAdded: () => void;
  pipelineStageNames: string[];
  mode: 'leads' | 'customers';
}

const AddInstitutionModal = ({ onClose, onAdded, pipelineStageNames, mode }: AddInstitutionModalProps) => {
  const defaultCrmStage = pipelineStageNames[0] ?? '';
  const defaultCrmClass = mode === 'customers' ? CRM_CUSTOMER_CLASS : CRM_LEAD_CLASS;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [crmClass, setCrmClass] = useState<string>(defaultCrmClass);
  const [crmStage, setCrmStage] = useState<string>(defaultCrmStage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageOptions = [
    ...pipelineStageNames,
    ...(crmStage && !pipelineStageNames.includes(crmStage) ? [crmStage] : []),
  ];

  useEffect(() => {
    if (!crmStage && defaultCrmStage) setCrmStage(defaultCrmStage);
  }, [crmStage, defaultCrmStage]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('שם מוסד הוא שדה חובה'); return; }
    setSaving(true);
    const safeCrmClass = crmClass || defaultCrmClass || CRM_LEAD_CLASS;
    const { error: dbErr } = await supabase
      .from('educational_institutions')
      .insert({ name: name.trim(), city: city.trim() || null, crm_class: safeCrmClass, crm_stage: crmStage || null });
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onAdded();
    onClose();
  };

  const inputStyle = {
    width: '100%', padding: '8px 11px', borderRadius: 7,
    border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
    outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.surface, borderRadius: 12, width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} dir="rtl">
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>+ הוסף מוסד</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 5 }}>שם מוסד *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: בית ספר רמות" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 5 }}>עיר</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="לדוגמה: תל אביב" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 5 }}>סיווג</label>
              <select value={crmClass} disabled={mode === 'leads'} onChange={(e) => setCrmClass(e.target.value || defaultCrmClass)} style={{ ...inputStyle, ...(mode === 'leads' ? { background: C.bg, color: C.textSub } : {}) }}>
                {CLASSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 5 }}>שלב</label>
              <select value={crmStage} onChange={(e) => setCrmStage(e.target.value)} style={{ ...inputStyle }}>
                {stageOptions.length === 0 && <option value="">— ללא שלב —</option>}
                {stageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: C.danger, background: C.dangerBg, padding: '8px 12px', borderRadius: 7 }}>{error}</div>}
        </div>
        <div style={{ padding: '13px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', fontSize: 13, padding: '8px 14px', background: C.accent, color: '#fff', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'שומר...' : '✓ הוסף מוסד'}
          </button>
          <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, fontSize: 13, padding: '8px 14px', background: C.surface, color: C.text }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

// ── sort helpers ──────────────────────────────────────────────

const sortRows = (
  rows: InstitutionRow[],
  key: SortKey,
  dir: SortDir,
  getEffectiveStage: (row: InstitutionRow) => string | null,
): InstitutionRow[] => {
  return [...rows].sort((a, b) => {
    let av: string | null = null;
    let bv: string | null = null;
    if (key === 'city') { av = a.city; bv = b.city; }
    else if (key === 'name') { av = a.name; bv = b.name; }
    else if (key === 'crm_stage') { av = getEffectiveStage(a); bv = getEffectiveStage(b); }
    else if (key === 'crm_last_contact_at') { av = a.crm_last_contact_at; bv = b.crm_last_contact_at; }
    const aStr = av ?? '';
    const bStr = bv ?? '';
    const cmp = aStr.localeCompare(bStr, 'he');
    return dir === 'asc' ? cmp : -cmp;
  });
};

// ── main component ────────────────────────────────────────────

interface Props {
  setTab: (tab: CRMTab) => void;
  mode: 'leads' | 'customers';
  openCsvImport?: boolean;
}

const CRMInstitutionsList = ({ setTab: _setTab, mode, openCsvImport }: Props) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const persistedTableState = getPersistedTableState(searchParams, mode);
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [pipelineStageNames, setPipelineStageNames] = useState<string[]>([]);
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCsv, setShowCsv] = useState(false);
  const [showAddInstitution, setShowAddInstitution] = useState(false);
  useEffect(() => { if (openCsvImport) setShowCsv(true); }, [openCsvImport]);
  const [assignTarget, setAssignTarget] = useState<InstitutionRow | null>(null);
  const [assignToast, setAssignToast] = useState<string | null>(null);
  const [deleteToast, setDeleteToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [inlineEditError, setInlineEditError] = useState<string | null>(null);

  // `search` = the committed query that actually filters the list (and is persisted).
  // `searchInput` = the live text-field draft; it only becomes `search` on
  // clicking "חיפוש" or pressing Enter, so we never filter/refetch per keystroke.
  const [search, setSearch] = useState(persistedTableState.search);
  const [searchInput, setSearchInput] = useState(persistedTableState.search);
  const [filterClass, setFilterClass] = useState(persistedTableState.filterClass);
  const [filterStage, setFilterStage] = useState(persistedTableState.filterStage);
  const [filterCity, setFilterCity] = useState(persistedTableState.filterCity);
  const [filterInstructor, setFilterInstructor] = useState(persistedTableState.filterInstructor);
  const [filterSchoolLevel, setFilterSchoolLevel] = useState(persistedTableState.filterSchoolLevel);
  const [filterContactStatus, setFilterContactStatus] = useState(persistedTableState.filterContactStatus);

  const [sortKey, setSortKey] = useState<SortKey>(persistedTableState.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(persistedTableState.sortDir);

  useEffect(() => {
    const state: PersistedTableState = {
      search,
      filterClass,
      filterStage,
      filterCity,
      filterInstructor,
      filterSchoolLevel,
      filterContactStatus,
      sortKey,
      sortDir,
    };

    sessionStorage.setItem(`${TABLE_STATE_PREFIX}:${mode}`, JSON.stringify(state));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', mode);

      const setOrDelete = (key: string, value: string, defaultValue: string) => {
        if (value && value !== defaultValue) next.set(key, value);
        else next.delete(key);
      };

      setOrDelete('q', search, defaultTableState.search);
      setOrDelete('class', filterClass, defaultTableState.filterClass);
      setOrDelete('stage', filterStage, defaultTableState.filterStage);
      setOrDelete('city', filterCity, defaultTableState.filterCity);
      setOrDelete('instructor', filterInstructor, defaultTableState.filterInstructor);
      setOrDelete('level', filterSchoolLevel, defaultTableState.filterSchoolLevel);
      setOrDelete('status', filterContactStatus, defaultTableState.filterContactStatus);
      setOrDelete('sort', sortKey, defaultTableState.sortKey);
      setOrDelete('dir', sortDir, defaultTableState.sortDir);
      return next;
    }, { replace: true });
  }, [filterCity, filterClass, filterContactStatus, filterInstructor, filterSchoolLevel, filterStage, mode, search, setSearchParams, sortDir, sortKey]);

  useEffect(() => {
    if (mode === 'leads') return;
    if (filterStage !== defaultTableState.filterStage) setFilterStage(defaultTableState.filterStage);
    if (sortKey === 'crm_stage') setSortKey(defaultTableState.sortKey);
  }, [filterStage, mode, sortKey]);

  const fetchPipelineStages = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .select('name')
      .order('order_index');

    if (!error && data) {
      setPipelineStageNames(
        (data as PipelineStageOption[])
          .map((stage) => stage.name?.trim())
          .filter((name): name is string => Boolean(name)),
      );
    }
  }, []);

  const fetchContactStatuses = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_contact_statuses')
      .select('id, key, label, color, order_index, legacy_crm_risk')
      .eq('is_active', true)
      .order('order_index');

    if (!error && data) {
      setContactStatuses(data as ContactStatus[]);
    }
  }, []);

  // ── load data ────────────────────────────────────────────────
  const fetchInstitutions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('educational_institutions')
      .select(`
        id, name, city,
        crm_class, crm_stage, crm_last_contact_at, crm_next_step, crm_next_step_date,
        crm_owner_id, crm_assigned_instructor_id,
        crm_potential, crm_notes, crm_risk, crm_contact_status_id, has_files, school_level,
        contact_status:crm_contact_status_id (id, key, label, color, order_index, legacy_crm_risk),
        instructor:crm_assigned_instructor_id (id, full_name),
        contacts:crm_contacts (id, name, phone, role, is_primary)
      `)
      .or(CRM_SOFT_DELETE_FILTER);

    if (mode === 'leads') {
      query = query.eq('crm_class', CRM_LEAD_CLASS);
    } else {
      query = query.eq('crm_class', CRM_CUSTOMER_CLASS);
    }

    const { data, error } = await query;

    if (!error && data) {
      const normalizedData = data;

      const institutionIds = normalizedData.map((d: any) => d.id);

      // Fetch primary contact phones in one query
      const phoneMap: Record<string, string | null> = {};
      if (institutionIds.length > 0) {
        const { data: phoneData } = await supabase
          .from('crm_contacts')
          .select('institution_id, phone')
          .in('institution_id', institutionIds)
          .eq('is_primary', true);
        if (phoneData) {
          for (const row of phoneData) {
            if (!phoneMap[row.institution_id]) {
              phoneMap[row.institution_id] = row.phone ?? null;
            }
          }
        }
      }

      setRows(
        normalizedData.map((d: any) => ({
          ...d,
          contact_status: Array.isArray(d.contact_status) ? d.contact_status[0] ?? null : d.contact_status,
          instructor: Array.isArray(d.instructor) ? d.instructor[0] ?? null : d.instructor,
          contacts: Array.isArray(d.contacts) ? d.contacts : [],
          primaryPhone: phoneMap[d.id] ?? null,
        })),
      );
    }
    setLoading(false);
  }, [mode]);

  useEffect(() => { fetchInstitutions(); }, [fetchInstitutions]);
  useEffect(() => { fetchPipelineStages(); }, [fetchPipelineStages]);
  useEffect(() => { fetchContactStatuses(); }, [fetchContactStatuses]);

  // ── derived filter options ───────────────────────────────────
  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))] as string[];
  const instructorNames = [...new Set(
    rows.map((r) => r.instructor?.full_name).filter(Boolean),
  )] as string[];

  // ── filtering + sorting ───────────────────────────────────────
  const defaultStage = pipelineStageNames[0] ?? null;
  const validStageNames = new Set(pipelineStageNames);
  const getEffectiveStage = (row: InstitutionRow) => {
    const stage = row.crm_stage?.trim() ?? '';
    return stage && validStageNames.has(stage) ? stage : defaultStage;
  };

  const stageFilterOptions = [
    ...pipelineStageNames,
    ...[...new Set(rows.map((r) => r.crm_stage?.trim()).filter(Boolean) as string[])]
      .filter((stage) => !pipelineStageNames.includes(stage)),
  ];

  const filtered = sortRows(
    rows.filter((r) => {
      if (search && !matchesLeadSearch(
        { name: r.name, city: r.city, phones: [r.primaryPhone, ...r.contacts.map((c) => c.phone)] },
        search,
      )) return false;
      if (filterClass !== 'הכל' && (mode === 'leads' ? (r.crm_class ?? CRM_LEAD_CLASS) : r.crm_class) !== filterClass) return false;
      if (mode === 'leads' && filterStage !== 'הכל' && getEffectiveStage(r) !== filterStage) return false;
      if (filterCity !== 'הכל' && r.city !== filterCity) return false;
      if (filterInstructor === 'לא משויך' && r.instructor) return false;
      if (filterInstructor !== 'הכל' && filterInstructor !== 'לא משויך' && r.instructor?.full_name !== filterInstructor) return false;
      if (filterSchoolLevel !== 'הכל') {
        if (filterSchoolLevel === 'ללא סיווג') {
          if (r.school_level) return false;
        } else if (r.school_level !== filterSchoolLevel) {
          return false;
        }
      }
      if (filterContactStatus !== 'הכל') {
        const effectiveStatus = getContactStatus(contactStatuses, r.crm_contact_status_id, r.crm_risk);
        if (effectiveStatus?.id !== filterContactStatus) return false;
      }
      return true;
    }),
    mode === 'leads' ? sortKey : (sortKey === 'crm_stage' ? defaultTableState.sortKey : sortKey),
    sortDir,
    getEffectiveStage,
  );

  const unassignedCount = rows.filter((r) => !r.instructor).length;
  const hasActiveFilters = filterClass !== 'הכל' || filterStage !== 'הכל' || filterCity !== 'הכל' || filterInstructor !== 'הכל' || filterSchoolLevel !== 'הכל' || filterContactStatus !== 'הכל';

  // Commit the draft text to the active query (Enter / "חיפוש" button).
  const applySearch = () => setSearch(searchInput.trim());

  // Clear only the text search — dropdown filters stay as they are.
  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const clearFilters = () => {
    setFilterClass('הכל');
    setFilterStage('הכל');
    setFilterCity('הכל');
    setFilterInstructor('הכל');
    setFilterSchoolLevel('הכל');
    setFilterContactStatus('הכל');
  };

  const formatLastContact = (iso: string | null) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return 'היום';
    if (diff === 1) return 'אתמול';
    if (diff <= 30) return `לפני ${diff} ימים`;
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: C.textDim, marginRight: 2 }}>↕</span>;
    return <span style={{ color: C.accent, marginRight: 2 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = (key?: SortKey): React.CSSProperties => ({
    padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600,
    color: key && sortKey === key ? C.accent : C.textSub,
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
    cursor: key ? 'pointer' : 'default',
    userSelect: 'none',
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
    setAssignToast(`✅ מדריך שויך — הודעה נשלחה ל${instructorName} עם פרטי הליד`);
    setTimeout(() => setAssignToast(null), 4000);
  };

  const handleNotesSaved = (id: string, notes: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, crm_notes: notes || null } : r));
  };

  const handleRiskChanged = (id: string, status: ContactStatus) => {
    setRows((prev) => prev.map((r) => r.id === id ? {
      ...r,
      crm_contact_status_id: status.id.startsWith('legacy-') ? null : status.id,
      contact_status: status.id.startsWith('legacy-') ? null : status,
    } : r));
  };

  const updateInstitutionField = async (id: string, patch: InstitutionPatch) => {
    const previousRows = rows;
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));

    const { error } = await supabase
      .from('educational_institutions')
      .update(patch)
      .eq('id', id);

    if (error) {
      setRows(previousRows);
      setInlineEditError(error.message);
      setTimeout(() => setInlineEditError(null), 5000);
      await fetchInstitutions();
      return false;
    }
    return true;
  };

  const handleStageChange = async (row: InstitutionRow, newStage: string | null) => {
    if (newStage === row.crm_stage) return;

    const saved = await updateInstitutionField(row.id, { crm_stage: newStage });
    if (!saved || !newStage) return;

    const { error } = await supabase.functions.invoke('crm-automation-trigger', {
      body: {
        institution_id: row.id,
        new_stage: newStage,
        old_stage: row.crm_stage ?? null,
      },
    });

    if (error) {
      console.warn('CRM stage automation failed', error);
      setInlineEditError('השלב עודכן, אך האוטומציה לא הופעלה');
      setTimeout(() => setInlineEditError(null), 5000);
    }
  };

  const patchRowContact = (institutionId: string, contact: CRMContact) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== institutionId) return r;
      const exists = r.contacts.some((c) => c.id === contact.id);
      const contacts = exists
        ? r.contacts.map((c) => c.id === contact.id ? { ...c, ...contact } : c)
        : [contact, ...r.contacts];
      const nextPrimaryContact = primaryContact({ ...r, contacts });
      return { ...r, contacts, primaryPhone: nextPrimaryContact?.phone ?? null };
    }));
  };

  const upsertInstitutionContact = async (row: InstitutionRow, patch: ContactPatch, contactToEdit?: CRMContact | null) => {
    const contact = contactToEdit ?? null;
    const normalizedPatch: ContactPatch = {};
    if ('name' in patch) normalizedPatch.name = patch.name?.trim() ?? '';
    if ('role' in patch) normalizedPatch.role = patch.role?.trim() || null;
    if ('phone' in patch) normalizedPatch.phone = patch.phone?.trim() || null;

    if (normalizedPatch.name != null && !normalizedPatch.name) {
      setInlineEditError('שם איש קשר הוא שדה חובה');
      setTimeout(() => setInlineEditError(null), 5000);
      return;
    }

    if (!contact && Object.values(normalizedPatch).every((value) => value == null || value === '')) return;
    if (!contact && row.contacts.length > 0) return;

    if (contact) {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update({ ...normalizedPatch, updated_at: new Date().toISOString() })
        .eq('id', contact.id)
        .select('id, name, phone, role, is_primary')
        .single();

      if (error || !data) {
        setInlineEditError(error?.message ?? 'שמירת איש הקשר נכשלה');
        setTimeout(() => setInlineEditError(null), 5000);
        await fetchInstitutions();
        return;
      }

      patchRowContact(row.id, data as CRMContact);
      return;
    }

    const insertPayload = {
      institution_id: row.id,
      name: normalizedPatch.name || row.name,
      is_primary: true,
      ...('role' in normalizedPatch ? { role: normalizedPatch.role } : {}),
      ...('phone' in normalizedPatch ? { phone: normalizedPatch.phone } : {}),
    };
    const { data, error } = await supabase
      .from('crm_contacts')
      .insert(insertPayload)
      .select('id, name, phone, role, is_primary')
      .single();

    if (error || !data) {
      setInlineEditError(error?.message ?? 'יצירת איש הקשר נכשלה');
      setTimeout(() => setInlineEditError(null), 5000);
      await fetchInstitutions();
      return;
    }

    patchRowContact(row.id, data as CRMContact);
  };

  const handleContactNameChange = (row: InstitutionRow, contact: CRMContact | null, newName: string) => {
    void upsertInstitutionContact(row, { name: newName }, contact);
  };

  const handleContactRoleChange = (row: InstitutionRow, contact: CRMContact | null, newRole: string) => {
    void upsertInstitutionContact(row, { role: newRole }, contact);
  };

  const handleContactPhoneChange = (row: InstitutionRow, contact: CRMContact | null, newPhone: string) => {
    void upsertInstitutionContact(row, { phone: newPhone }, contact);
  };

  const showDeleteToast = (message: string, type: 'success' | 'error') => {
    setDeleteToast({ message, type });
    setTimeout(() => setDeleteToast(null), 5000);
  };

  const handleDeleteInstitution = async (row: InstitutionRow) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את המוסד? פעולה זו אינה ניתנת לביטול.')) return;

    const { error } = await supabase
      .from('educational_institutions')
      .update({ is_deleted: true })
      .eq('id', row.id);

    if (error) {
      console.error('Failed to delete institution', error);
      showDeleteToast('לא ניתן למחוק את המוסד. ייתכן שקיימים נתונים מקושרים.', 'error');
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    showDeleteToast('המוסד נמחק בהצלחה', 'success');
  };

  // Sortable column headers config
  const SORTABLE_COLS: { label: string; key?: SortKey; colSpan?: number }[] = [
    { label: 'מוסד', key: 'name' },
    { label: 'עיר', key: 'city' },
    { label: 'סוג מוסד' },
    { label: 'סטטוס' },
    { label: 'שלב', key: 'crm_stage' },
    { label: 'אנשי קשר' },
    { label: mode === 'leads' ? 'מדריך מוכר' : 'מדריך לתכנית' },
    { label: 'קשר אחרון', key: 'crm_last_contact_at' },
    { label: 'הערות' },
    { label: 'פעולות' },
  ];

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto' }}>
      {showCsv && <CsvModal onClose={() => setShowCsv(false)} onImportDone={fetchInstitutions} pipelineStageNames={pipelineStageNames} />}
      {showAddInstitution && <AddInstitutionModal onClose={() => setShowAddInstitution(false)} onAdded={fetchInstitutions} pipelineStageNames={pipelineStageNames} mode={mode} />}
      {assignTarget && (
        <AssignInstructorModal
          institutionId={assignTarget.id}
          institutionName={assignTarget.name}
          institutionCity={assignTarget.city}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}

      {assignToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: '#16A34A', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {assignToast}
        </div>
      )}

      {inlineEditError && (
        <div style={{
          position: 'fixed', bottom: assignToast ? 72 : 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: C.danger, color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {inlineEditError}
        </div>
      )}

      {deleteToast && (
        <div style={{
          position: 'fixed', bottom: assignToast || inlineEditError ? 72 : 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, background: deleteToast.type === 'success' ? C.success : C.danger, color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {deleteToast.message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
            }}
            placeholder="🔍  חיפוש לפי שם, עיר או טלפון"
            style={{ padding: '7px 30px 7px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, width: 230, outline: 'none', color: C.text }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              title="נקה חיפוש"
              aria-label="נקה חיפוש"
              style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: C.textDim, fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: 2 }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={applySearch}
          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          חיפוש
        </button>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={filterSelectStyle(filterClass !== 'הכל')}>
          <option value="הכל">{mode === 'leads' ? 'סיווג' : 'סטטוס'}</option>
          {CLASSES.map((o) => <option key={o}>{o}</option>)}
        </select>
        {mode === 'leads' && (
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} style={filterSelectStyle(filterStage !== 'הכל')}>
            <option value="הכל">שלב בפייפליין</option>
            {stageFilterOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        )}
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={filterSelectStyle(filterCity !== 'הכל')}>
          <option value="הכל">עיר</option>
          {cities.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={filterInstructor} onChange={(e) => setFilterInstructor(e.target.value)} style={filterSelectStyle(filterInstructor !== 'הכל')}>
          <option value="הכל">מדריך</option>
          <option value="לא משויך">לא משויך</option>
          {instructorNames.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={filterSchoolLevel} onChange={(e) => setFilterSchoolLevel(e.target.value)} style={filterSelectStyle(filterSchoolLevel !== 'הכל')}>
          <option value="הכל">סוג מוסד</option>
          <option value="elementary">יסודי</option>
          <option value="secondary">על-יסודי</option>
          <option value="ללא סיווג">ללא סיווג</option>
        </select>
        <select value={filterContactStatus} onChange={(e) => setFilterContactStatus(e.target.value)} style={filterSelectStyle(filterContactStatus !== 'הכל')}>
          <option value="הכל">סטטוס</option>
          {(contactStatuses.length > 0 ? contactStatuses : LEGACY_CONTACT_STATUS_FALLBACK).map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
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
        <button onClick={() => setShowAddInstitution(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12, padding: '5px 11px', background: C.accent, color: '#fff' }}>
          + הוסף מוסד
        </button>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'visible' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>טוען...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {SORTABLE_COLS.filter((col) => mode === 'leads' || col.key !== 'crm_stage').map(({ label, key }) => (
                  <th
                    key={label}
                    style={thStyle(key)}
                    onClick={key ? () => handleSort(key) : undefined}
                  >
                    {key ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{label}{sortArrow(key)}</span> : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={SORTABLE_COLS.filter((col) => mode === 'leads' || col.key !== 'crm_stage').length} style={{ padding: '32px', textAlign: 'center', color: C.textSub, fontSize: 13 }}>לא נמצאו מוסדות</td>
                </tr>
              ) : filtered.map((row) => {
                const visibleContact = primaryContact(row);
                const additionalContactsCount = Math.max(row.contacts.length - 1, 0);
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.accent }}>
                        <span>{row.name}</span>
                        {row.has_files && (
                          <button
                            type="button"
                            title="יש קבצים למוסד"
                            aria-label="יש קבצים למוסד"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/institution/${row.id}?tab=files`);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              border: 'none',
                              background: 'transparent',
                              color: C.textSub,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <Paperclip size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* City */}
                    <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <InlineTextCell
                        value={row.city}
                        placeholder="+ עיר"
                        onSave={(value) => updateInstitutionField(row.id, { city: value.trim() || null })}
                        style={{ fontSize: 12, color: C.textSub }}
                      />
                    </td>

                    {/* School level */}
                    <td style={{ padding: '9px 12px' }}>
                      <SchoolLevelDropdown
                        value={row.school_level}
                        onChange={(next) => updateInstitutionField(row.id, { school_level: next })}
                      />
                    </td>

                    {/* Status / Risk */}
                    <td style={{ padding: '9px 12px' }}>
                      <RiskDropdown
                        institutionId={row.id}
                        statusId={row.crm_contact_status_id}
                        legacyRisk={row.crm_risk}
                        statuses={contactStatuses}
                        onChanged={handleRiskChanged}
                      />
                    </td>

                    {mode === 'leads' && (
                      <>
                        {/* Stage */}
                        <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                          <InlineSelectCell
                            value={getEffectiveStage(row)}
                            options={stageFilterOptions}
                            onChange={(value) => handleStageChange(row, value)}
                          />
                        </td>
                      </>
                    )}

                    {/* Contacts */}
                    <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', minWidth: 160 }}>
                        <Av name={visibleContact?.name ?? '?'} size={22} />
                        <div style={{ display: 'grid', gap: 4, minWidth: 130, maxWidth: 190 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <InlineTextCell
                                value={visibleContact?.name ?? null}
                                placeholder="+ איש קשר"
                                onSave={(value) => handleContactNameChange(row, visibleContact, value)}
                              />
                            </div>
                            {additionalContactsCount > 0 && (
                              <span
                                title={`יש עוד ${additionalContactsCount} אנשי קשר`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 24,
                                  height: 20,
                                  padding: '0 6px',
                                  borderRadius: 999,
                                  background: C.accentBg,
                                  color: C.accent,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                +{additionalContactsCount}
                              </span>
                            )}
                          </div>
                          <InlineTextCell
                            value={visibleContact?.role ?? null}
                            placeholder="+ תפקיד"
                            onSave={(value) => handleContactRoleChange(row, visibleContact, value)}
                            style={{ fontSize: 11, color: C.textSub, padding: '3px 7px' }}
                          />
                          <InlineTextCell
                            value={visibleContact?.phone ?? null}
                            placeholder="+ טלפון"
                            onSave={(value) => handleContactPhoneChange(row, visibleContact, value)}
                          />
                        </div>
                      </div>
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
                    <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <InlineDateCell
                        value={row.crm_last_contact_at}
                        onChange={(value) => updateInstitutionField(row.id, { crm_last_contact_at: value })}
                      />
                    </td>

                    {/* Notes */}
                    <td
                      style={{ padding: '9px 12px', minWidth: 140, maxWidth: 200 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <NotesPopover
                        institutionId={row.id}
                        notes={row.crm_notes}
                        onSaved={handleNotesSaved}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteInstitution(row)}
                        title="מחיקת מוסד"
                        aria-label="מחיקת מוסד"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: `1px solid ${C.danger}30`,
                          background: C.dangerBg,
                          color: C.danger,
                          cursor: 'pointer',
                          fontSize: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                      </button>
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
