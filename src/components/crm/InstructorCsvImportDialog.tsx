import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Loader2, Upload, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getRegionByCity,
  getRegionColor,
  getRegionLabel,
  REGION_KEYS,
  type RegionKey,
} from '@/lib/instructors/regions';
import {
  INSTRUCTOR_STATUSES,
  parseDays,
  parseNumeric,
  splitList,
  validateInstructor,
  type ValidationIssue,
} from '@/lib/instructors/validation';

const TEMPLATE_HEADERS = [
  'full_name', 'role_type', 'phone', 'email', 'city', 'region', 'address',
  'travel_radius_km', 'subjects', 'audiences', 'languages', 'availability_days',
  'availability_hours', 'hourly_rate', 'hourly_rate_notes', 'employment_type',
  'status', 'rating_score', 'rating_notes', 'quality_tags', 'notes',
] as const;

type Action = 'import' | 'update' | 'skip';

interface RawRow {
  full_name: string;
  role_type: string;
  phone: string;
  email: string;
  city: string;
  region: string;
  address: string;
  travel_radius_km: string;
  subjects: string;
  audiences: string;
  languages: string;
  availability_days: string;
  availability_hours: string;
  hourly_rate: string;
  hourly_rate_notes: string;
  employment_type: string;
  status: string;
  rating_score: string;
  rating_notes: string;
  quality_tags: string;
  notes: string;
}

interface ParsedRow {
  raw: RawRow;
  full_name: string;
  role_type: string | null;
  phone: string | null;
  email: string | null;
  city: string;
  uploadedRegion: string | null;
  autoRegion: RegionKey | null;
  finalRegion: string | null;
  address: string | null;
  travel_radius_km: number | null;
  subjects: string[];
  audiences: string[];
  languages: string[];
  availability_days: number[];
  availability_hours: { from?: string; to?: string } | null;
  hourly_rate: number | null;
  hourly_rate_notes: string | null;
  employment_type: string | null;
  status: string;
  rating_score: number | null;
  rating_notes: string | null;
  quality_tags: string[];
  notes: string | null;
  issues: ValidationIssue[];
  duplicateId: string | null;
  action: Action;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

const parseAvailabilityHours = (raw: string): { from?: string; to?: string } | null => {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (m) return { from: m[1], to: m[2] };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as { from?: string; to?: string };
  } catch {
    /* ignore */
  }
  return null;
};

const buildRow = (
  raw: RawRow,
  existingByEmail: Map<string, string>,
  existingByPhone: Map<string, string>
): ParsedRow => {
  const city = raw.city.trim();
  const uploadedRegion = raw.region.trim() || null;
  const autoRegion = city ? getRegionByCity(city) : null;
  const finalRegion = uploadedRegion ?? autoRegion ?? null;

  const phone = raw.phone.trim().replace(/[^\d+]/g, '') || null;
  const email = raw.email.trim().toLowerCase() || null;
  const hourly_rate = parseNumeric(raw.hourly_rate);
  const travel_radius_km = parseNumeric(raw.travel_radius_km);
  const rating_score = parseNumeric(raw.rating_score);
  const subjects = splitList(raw.subjects);
  const audiences = splitList(raw.audiences);
  const languages = splitList(raw.languages);
  const quality_tags = splitList(raw.quality_tags);
  const availability_days = parseDays(raw.availability_days);
  const availability_hours = parseAvailabilityHours(raw.availability_hours);
  const statusRaw = raw.status.trim();
  const status = statusRaw && INSTRUCTOR_STATUSES.includes(statusRaw as typeof INSTRUCTOR_STATUSES[number])
    ? statusRaw
    : 'active';

  const dupId =
    (email && existingByEmail.get(email)) ||
    (phone && existingByPhone.get(phone)) ||
    null;

  const issues = validateInstructor({
    full_name: raw.full_name,
    city,
    phone,
    email,
    hourly_rate: hourly_rate ?? undefined,
    travel_radius_km: travel_radius_km ?? undefined,
    rating_score: rating_score ?? undefined,
    status,
    region: uploadedRegion ?? undefined,
  });
  if (rating_score !== null && (rating_score < 1 || rating_score > 5)) {
    // covered by validator but keep defensive
  }
  if (raw.hourly_rate.trim() && hourly_rate === null) {
    issues.push({ field: 'hourly_rate', message: 'תעריף לא תקין', level: 'error' });
  }
  if (raw.rating_score.trim() && rating_score === null) {
    issues.push({ field: 'rating_score', message: 'ציון לא מספרי', level: 'error' });
  }

  const hasError = issues.some((i) => i.level === 'error');
  const action: Action = hasError ? 'skip' : dupId ? 'skip' : 'import';

  return {
    raw,
    full_name: raw.full_name.trim(),
    role_type: raw.role_type.trim() || null,
    phone,
    email,
    city,
    uploadedRegion,
    autoRegion,
    finalRegion,
    address: raw.address.trim() || null,
    travel_radius_km,
    subjects,
    audiences,
    languages,
    availability_days,
    availability_hours,
    hourly_rate,
    hourly_rate_notes: raw.hourly_rate_notes.trim() || null,
    employment_type: raw.employment_type.trim() || null,
    status,
    rating_score,
    rating_notes: raw.rating_notes.trim() || null,
    quality_tags,
    notes: raw.notes.trim() || null,
    issues,
    duplicateId: dupId,
    action,
  };
};

const InstructorCsvImportDialog = ({ open, onOpenChange, onCompleted }: Props) => {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setRows([]);
      setResult(null);
      setImporting(false);
    }
  }, [open]);

  const parseFile = async (file: File) => {
    // Load existing instructors for duplicate detection.
    const { data: existing } = await supabase
      .from('instructors')
      .select('id, email, phone');
    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const e of existing ?? []) {
      const r = e as { id: string; email: string | null; phone: string | null };
      if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
      if (r.phone) byPhone.set(r.phone.replace(/[^\d+]/g, ''), r.id);
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t'],
      encoding: 'UTF-8',
      complete: (parseResult) => {
        const parsed: ParsedRow[] = parseResult.data.map((r) => {
          const norm: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            norm[k.replace(/^﻿/, '').trim()] = (v ?? '').toString().trim();
          }
          const raw: RawRow = {
            full_name: norm.full_name ?? '',
            role_type: norm.role_type ?? '',
            phone: norm.phone ?? '',
            email: norm.email ?? '',
            city: norm.city ?? '',
            region: norm.region ?? '',
            address: norm.address ?? '',
            travel_radius_km: norm.travel_radius_km ?? '',
            subjects: norm.subjects ?? '',
            audiences: norm.audiences ?? '',
            languages: norm.languages ?? '',
            availability_days: norm.availability_days ?? '',
            availability_hours: norm.availability_hours ?? '',
            hourly_rate: norm.hourly_rate ?? '',
            hourly_rate_notes: norm.hourly_rate_notes ?? '',
            employment_type: norm.employment_type ?? '',
            status: norm.status ?? '',
            rating_score: norm.rating_score ?? '',
            rating_notes: norm.rating_notes ?? '',
            quality_tags: norm.quality_tags ?? '',
            notes: norm.notes ?? '',
          };
          return buildRow(raw, byEmail, byPhone);
        });
        setRows(parsed);
        setStep(1);
      },
    });
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt|xlsx?)$/i)) {
      toast.error('פורמט קובץ לא נתמך');
      return;
    }
    parseFile(file);
  };

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/templates/instructors-template.csv';
    a.download = 'instructors-template.csv';
    a.click();
  };

  const updateRowAction = (idx: number, next: Action) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, action: next } : r)));
  };

  const counts = useMemo(() => {
    let importN = 0;
    let updateN = 0;
    let skipN = 0;
    let invalidN = 0;
    for (const r of rows) {
      if (r.issues.some((i) => i.level === 'error')) invalidN++;
      if (r.action === 'import') importN++;
      else if (r.action === 'update') updateN++;
      else skipN++;
    }
    return { import: importN, update: updateN, skip: skipN, invalid: invalidN, total: rows.length };
  }, [rows]);

  const runImport = async () => {
    setImporting(true);
    setStep(2);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      if (row.action === 'skip' || row.issues.some((i) => i.level === 'error')) {
        skipped++;
        continue;
      }
      const payload = {
        full_name: row.full_name,
        role_type: row.role_type,
        phone: row.phone,
        email: row.email,
        city: row.city,
        region: row.finalRegion,
        address: row.address,
        travel_radius_km: row.travel_radius_km,
        subjects: row.subjects,
        audiences: row.audiences,
        languages: row.languages,
        availability_days: row.availability_days,
        availability_hours: row.availability_hours,
        hourly_rate: row.hourly_rate,
        hourly_rate_notes: row.hourly_rate_notes,
        employment_type: row.employment_type,
        status: row.status,
        rating_score: row.rating_score,
        rating_notes: row.rating_notes,
        quality_tags: row.quality_tags,
        notes: row.notes,
      };
      try {
        if (row.action === 'update' && row.duplicateId) {
          const { error } = await supabase
            .from('instructors')
            .update(payload)
            .eq('id', row.duplicateId);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from('instructors')
            .insert([payload]);
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        console.error('import row failed', err, row);
        errors++;
      }
    }

    setResult({ inserted, updated, skipped, errors });
    setImporting(false);
    setStep(3);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא מדריכים מ-CSV</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-3 text-xs border-b pb-2">
          {(['העלאה', 'תצוגה מקדימה', 'ייבוא', 'סיום'] as const).map((label, i) => (
            <div key={label} className={`flex items-center gap-1 ${step >= i ? '' : 'opacity-40'}`}>
              <span
                className={[
                  'w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px]',
                  step > i ? 'bg-emerald-500 text-white' : step === i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
                ].join(' ')}
              >
                {step > i ? '✓' : i + 1}
              </span>
              <span>{label}</span>
              {i < 3 && <span className="text-gray-300">›</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {step === 0 && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={[
                  'cursor-pointer border-2 border-dashed rounded-lg p-12 text-center transition',
                  dragOver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-300 hover:border-blue-300',
                ].join(' ')}
              >
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <div className="text-sm font-semibold text-gray-700 mb-1">גרור קובץ CSV או לחץ לבחירה</div>
                <div className="text-xs text-gray-500">קבצים נתמכים: .csv .txt .xlsx</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  שדות חובה: full_name, city, וגם phone או email
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-3.5 h-3.5 ms-1" />
                  הורד תבנית
                </Button>
              </div>

              <div className="mt-2 text-[11px] text-gray-500 font-mono break-words border-t pt-2">
                {TEMPLATE_HEADERS.join(', ')}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">להוסיף: {counts.import}</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">לעדכן: {counts.update}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">לדלג: {counts.skip}</span>
                {counts.invalid > 0 && (
                  <span className="px-2 py-1 bg-red-50 text-red-700 rounded">לא תקין: {counts.invalid}</span>
                )}
              </div>

              <div className="border rounded overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">#</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">שם</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">עיר</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">אזור (מועלה / אוטו׳)</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">תעריף</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">ציון</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">סטטוס / שגיאות</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-700">פעולה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const finalColor = getRegionColor(row.finalRegion);
                        const finalLabel = getRegionLabel(row.finalRegion);
                        const hasErr = row.issues.some((x) => x.level === 'error');
                        return (
                          <tr key={i} className={[hasErr ? 'bg-red-50' : '', 'border-t border-gray-100'].join(' ')}>
                            <td className="px-2 py-2 align-top text-gray-500">{i + 1}</td>
                            <td className="px-2 py-2 align-top">{row.full_name || <span className="text-red-600">חסר</span>}</td>
                            <td className="px-2 py-2 align-top">{row.city || <span className="text-red-600">חסר</span>}</td>
                            <td className="px-2 py-2 align-top">
                              <div className="flex flex-col gap-1">
                                {row.finalRegion ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${finalColor.badgeClass} self-start`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${finalColor.dotClass}`} />
                                    {finalLabel}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                                {row.uploadedRegion && row.autoRegion && row.uploadedRegion !== row.autoRegion && (
                                  <span className="text-amber-700 text-[10px]">
                                    אי-התאמה: עיר מצביעה על {getRegionLabel(row.autoRegion)}
                                  </span>
                                )}
                                {row.uploadedRegion && !REGION_KEYS.includes(row.uploadedRegion as RegionKey) && (
                                  <span className="text-amber-700 text-[10px]">אזור לא מזוהה במערכת</span>
                                )}
                                {!row.uploadedRegion && row.autoRegion && (
                                  <span className="text-gray-500 text-[10px]">סווג אוטומטית</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              {row.hourly_rate !== null ? `₪${row.hourly_rate}` : '—'}
                            </td>
                            <td className="px-2 py-2 align-top">
                              {row.rating_score !== null ? row.rating_score.toFixed(1) : '—'}
                            </td>
                            <td className="px-2 py-2 align-top">
                              {row.duplicateId && (
                                <div className="text-[11px] text-blue-700 mb-1">כפיל זוהה</div>
                              )}
                              {row.issues.map((iss, k) => (
                                <div
                                  key={k}
                                  className={iss.level === 'error' ? 'text-red-700 text-[11px]' : 'text-amber-700 text-[11px]'}
                                >
                                  · {iss.message}
                                </div>
                              ))}
                              {!row.issues.length && !row.duplicateId && (
                                <span className="text-emerald-700 text-[11px]">תקין</span>
                              )}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <select
                                value={row.action}
                                disabled={hasErr && row.action !== 'skip'}
                                onChange={(e) => updateRowAction(i, e.target.value as Action)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="import" disabled={hasErr}>הוסף</option>
                                {row.duplicateId && <option value="update">עדכן קיים</option>}
                                <option value="skip">דלג</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>חזור</Button>
                <Button onClick={runImport} disabled={counts.import + counts.update === 0}>
                  ייבא ({counts.import + counts.update})
                </Button>
              </div>
            </div>
          )}

          {step === 2 && importing && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <div>מייבא מדריכים...</div>
            </div>
          )}

          {step === 3 && result && (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">✅</div>
              <div className="text-base font-semibold mb-4">הייבוא הושלם</div>
              <div className="inline-flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-8 px-4 py-2 bg-emerald-50 rounded">
                  <span className="text-emerald-700">נוספו</span>
                  <span className="font-bold text-emerald-700">{result.inserted}</span>
                </div>
                <div className="flex justify-between gap-8 px-4 py-2 bg-blue-50 rounded">
                  <span className="text-blue-700">עודכנו</span>
                  <span className="font-bold text-blue-700">{result.updated}</span>
                </div>
                <div className="flex justify-between gap-8 px-4 py-2 bg-gray-100 rounded">
                  <span className="text-gray-700">דולגו</span>
                  <span className="font-bold text-gray-700">{result.skipped}</span>
                </div>
                {result.errors > 0 && (
                  <div className="flex justify-between gap-8 px-4 py-2 bg-red-50 rounded">
                    <span className="text-red-700">שגיאות</span>
                    <span className="font-bold text-red-700">{result.errors}</span>
                  </div>
                )}
              </div>
              <div className="mt-6">
                <Button
                  onClick={() => {
                    onCompleted?.();
                    onOpenChange(false);
                  }}
                >
                  סיום
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstructorCsvImportDialog;
