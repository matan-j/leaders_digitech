import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Loader2, Plus, Upload, Download, Star, Phone, Mail,
  Search, MoreVertical, Eye, Pencil, UserX, Building2, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import {
  REGIONS, REGION_KEYS, getRegionColor, getRegionLabel, type RegionKey,
} from '@/lib/instructors/regions';
import {
  INSTRUCTOR_STATUSES, ROLE_TYPES, ROLE_TYPE_LABEL, STATUS_LABEL, STATUS_BADGE,
  type InstructorStatus,
} from '@/lib/instructors/validation';
import InstructorRegionTabs, { type RegionTabValue } from './InstructorRegionTabs';
import AddInstructorModal, { type InstructorRecord } from './AddInstructorModal';
import InstructorCsvImportDialog from './InstructorCsvImportDialog';
import AssignInstructorPlanningDialog from './AssignInstructorPlanningDialog';

interface InstructorRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  role_type: string | null;
  phone: string | null;
  email: string | null;
  city: string;
  region: string | null;
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
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const STORAGE_KEY = 'crmInstructorsListState';

interface PersistedState {
  region: RegionTabValue;
  search: string;
  filterCity: string;
  filterRole: string;
  filterStatus: string;
  filterSubject: string;
  filterAudience: string;
  filterDay: string;
  filterRatingMin: string;
}

const defaultState: PersistedState = {
  region: 'all',
  search: '',
  filterCity: 'הכל',
  filterRole: 'הכל',
  filterStatus: 'active',
  filterSubject: 'הכל',
  filterAudience: 'הכל',
  filterDay: 'הכל',
  filterRatingMin: 'הכל',
};

const readStored = (): Partial<PersistedState> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const writeStored = (state: PersistedState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

const initialState = (params: URLSearchParams): PersistedState => {
  const stored = readStored();
  const regionParam = params.get('region');
  const region: RegionTabValue =
    regionParam === 'all' || REGION_KEYS.includes(regionParam as RegionKey)
      ? (regionParam as RegionTabValue)
      : (stored.region ?? defaultState.region);
  return {
    region,
    search: params.get('q') ?? stored.search ?? defaultState.search,
    filterCity: params.get('city') ?? stored.filterCity ?? defaultState.filterCity,
    filterRole: params.get('role') ?? stored.filterRole ?? defaultState.filterRole,
    filterStatus: params.get('status') ?? stored.filterStatus ?? defaultState.filterStatus,
    filterSubject: params.get('subject') ?? stored.filterSubject ?? defaultState.filterSubject,
    filterAudience: params.get('audience') ?? stored.filterAudience ?? defaultState.filterAudience,
    filterDay: params.get('day') ?? stored.filterDay ?? defaultState.filterDay,
    filterRatingMin: params.get('rating') ?? stored.filterRatingMin ?? defaultState.filterRatingMin,
  };
};

const formatRate = (n: number | null) => (n === null ? '—' : `₪${n.toLocaleString('he-IL')} / שעה`);

const AvailabilityCompact = ({ days, hours }: { days: number[]; hours: { from?: string; to?: string } | null }) => {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {DAY_LABELS.map((label, idx) => (
          <span
            key={idx}
            className={[
              'inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-semibold',
              days.includes(idx) ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300',
            ].join(' ')}
          >
            {label}
          </span>
        ))}
      </div>
      {hours?.from && hours?.to && (
        <span className="text-[11px] text-gray-500">
          {hours.from}–{hours.to}
        </span>
      )}
    </div>
  );
};

const Stars = ({ score }: { score: number | null }) => {
  if (score === null) return <span className="text-xs text-gray-400">טרם דורג</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-600 text-xs font-semibold">
      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" />
      {score.toFixed(1)}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const known = STATUS_BADGE[status as InstructorStatus] ?? { color: '#6B7280', bg: '#F3F4F6' };
  const label = STATUS_LABEL[status as InstructorStatus] ?? status;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: known.color, background: known.bg }}
    >
      {label}
    </span>
  );
};

const ChipList = ({ items, color }: { items: string[]; color: 'blue' | 'green' }) => {
  if (!items?.length) return <span className="text-gray-400 text-xs">—</span>;
  const head = items.slice(0, 3);
  const rest = items.length - head.length;
  const cls = color === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700';
  return (
    <div className="flex flex-wrap gap-1">
      {head.map((s) => (
        <Badge key={s} variant="secondary" className={`${cls} text-[10px]`}>{s}</Badge>
      ))}
      {rest > 0 && <span className="text-[10px] text-gray-500">+{rest}</span>}
    </div>
  );
};

const CRMInstructorsList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<PersistedState>(() => initialState(searchParams));
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [loadByProfile, setLoadByProfile] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorRecord | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [assigning, setAssigning] = useState<{ id: string; name: string; focus: 'institution' | 'course' } | null>(null);

  // Persist state to sessionStorage + URL.
  useEffect(() => {
    writeStored(state);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'instructors');
      next.set('region', state.region);
      const setOrDelete = (key: string, value: string, defaultValue: string) => {
        if (value && value !== defaultValue) next.set(key, value);
        else next.delete(key);
      };
      setOrDelete('q', state.search, '');
      setOrDelete('city', state.filterCity, 'הכל');
      setOrDelete('role', state.filterRole, 'הכל');
      setOrDelete('status', state.filterStatus, 'active');
      setOrDelete('subject', state.filterSubject, 'הכל');
      setOrDelete('audience', state.filterAudience, 'הכל');
      setOrDelete('day', state.filterDay, 'הכל');
      setOrDelete('rating', state.filterRatingMin, 'הכל');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('instructors')
      .select(
        'id, profile_id, full_name, role_type, phone, email, city, region, address, travel_radius_km, subjects, audiences, languages, availability_days, availability_hours, hourly_rate, hourly_rate_notes, employment_type, status, rating_score, rating_notes, quality_tags, notes'
      );
    if (error) {
      console.error('failed to fetch instructors', error);
      toast.error(`טעינת מדריכים נכשלה: ${error.message ?? ''}`);
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as InstructorRow[];
    setRows(list);

    // Hydrate current_load for instructors with profile_id.
    const profileIds = list.map((r) => r.profile_id).filter(Boolean) as string[];
    if (profileIds.length > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: ciRows } = await supabase
        .from('course_instances')
        .select('instructor_id, end_date')
        .in('instructor_id', profileIds)
        .gte('end_date', todayIso);
      const counts: Record<string, number> = {};
      for (const ci of ciRows ?? []) {
        const pid = (ci as { instructor_id: string }).instructor_id;
        counts[pid] = (counts[pid] ?? 0) + 1;
      }
      setLoadByProfile(counts);
    } else {
      setLoadByProfile({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  // Build filter dropdown options dynamically from the data.
  const cityOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort();
  }, [rows]);
  const subjectOptions = useMemo(() => {
    const all = new Set<string>();
    rows.forEach((r) => r.subjects?.forEach((s) => all.add(s)));
    return Array.from(all).sort();
  }, [rows]);
  const audienceOptions = useMemo(() => {
    const all = new Set<string>();
    rows.forEach((r) => r.audiences?.forEach((s) => all.add(s)));
    return Array.from(all).sort();
  }, [rows]);

  // Region counts across all rows (ignoring region filter so users can see other regions).
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      const k = r.region ?? '__unmapped__';
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  // Apply filters.
  const filtered = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    const minRating = state.filterRatingMin === 'הכל' ? null : parseFloat(state.filterRatingMin);
    return rows
      .filter((r) => {
        if (state.region !== 'all' && r.region !== state.region) return false;
        if (state.filterCity !== 'הכל' && r.city !== state.filterCity) return false;
        if (state.filterRole !== 'הכל' && r.role_type !== state.filterRole) return false;
        if (state.filterStatus !== 'הכל' && r.status !== state.filterStatus) return false;
        if (state.filterSubject !== 'הכל' && !(r.subjects ?? []).includes(state.filterSubject)) return false;
        if (state.filterAudience !== 'הכל' && !(r.audiences ?? []).includes(state.filterAudience)) return false;
        if (state.filterDay !== 'הכל') {
          const d = parseInt(state.filterDay, 10);
          if (!Number.isNaN(d) && !(r.availability_days ?? []).includes(d)) return false;
        }
        if (minRating !== null && (r.rating_score ?? -1) < minRating) return false;
        if (q) {
          const hay = [r.full_name, r.email, r.phone, r.city]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. active first
        const aActive = a.status === 'active' ? 0 : 1;
        const bActive = b.status === 'active' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        // 2. rating desc, NULLs last
        const ar = a.rating_score ?? -Infinity;
        const br = b.rating_score ?? -Infinity;
        if (ar !== br) return br - ar;
        // 3. when region/city filter active, same-region first (already filtered, this is a no-op)
        // 4. current_load asc
        const al = a.profile_id ? loadByProfile[a.profile_id] ?? 0 : 0;
        const bl = b.profile_id ? loadByProfile[b.profile_id] ?? 0 : 0;
        return al - bl;
      });
  }, [rows, state, loadByProfile]);

  const updateState = <K extends keyof PersistedState>(key: K, value: PersistedState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const exportCsv = () => {
    const headers = [
      'full_name', 'role_type', 'phone', 'email', 'city', 'region', 'subjects',
      'audiences', 'hourly_rate', 'rating_score', 'status',
    ];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    for (const r of filtered) {
      lines.push(
        [
          r.full_name, r.role_type ?? '', r.phone ?? '', r.email ?? '', r.city, r.region ?? '',
          (r.subjects ?? []).join(';'), (r.audiences ?? []).join(';'),
          r.hourly_rate?.toString() ?? '', r.rating_score?.toString() ?? '', r.status,
        ].map((v) => escape(String(v ?? ''))).join(',')
      );
    }
    const bom = '﻿';
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'instructors-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toRecord = (r: InstructorRow): InstructorRecord => ({
    id: r.id,
    profile_id: r.profile_id,
    full_name: r.full_name,
    role_type: r.role_type,
    phone: r.phone,
    email: r.email,
    city: r.city,
    region: r.region,
    address: r.address,
    travel_radius_km: r.travel_radius_km,
    subjects: r.subjects ?? [],
    audiences: r.audiences ?? [],
    languages: r.languages ?? [],
    availability_days: r.availability_days ?? [],
    availability_hours: r.availability_hours,
    hourly_rate: r.hourly_rate,
    hourly_rate_notes: r.hourly_rate_notes,
    employment_type: r.employment_type,
    status: r.status,
    rating_score: r.rating_score,
    rating_notes: r.rating_notes,
    quality_tags: r.quality_tags ?? [],
    notes: r.notes,
  });

  const markInactive = async (id: string) => {
    const { error } = await supabase.from('instructors').update({ status: 'inactive' }).eq('id', id);
    if (error) {
      toast.error('פעולה נכשלה');
      return;
    }
    toast.success('המדריך סומן כלא פעיל');
    fetchInstructors();
  };

  return (
    <div dir="rtl" className="bg-background min-h-screen">
      <InstructorRegionTabs
        active={state.region}
        counts={regionCounts}
        onChange={(next) => updateState('region', next)}
      />

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={state.search}
            onChange={(e) => updateState('search', e.target.value)}
            placeholder="חיפוש שם / אימייל / טלפון / עיר"
            className="ps-3 pe-8 w-72 h-9 text-sm"
          />
        </div>

        <select
          value={state.filterCity}
          onChange={(e) => updateState('filterCity', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל הערים</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={state.filterRole}
          onChange={(e) => updateState('filterRole', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל התפקידים</option>
          {ROLE_TYPES.map((r) => (
            <option key={r} value={r}>{ROLE_TYPE_LABEL[r]}</option>
          ))}
        </select>

        <select
          value={state.filterStatus}
          onChange={(e) => updateState('filterStatus', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל הסטטוסים</option>
          {INSTRUCTOR_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <select
          value={state.filterSubject}
          onChange={(e) => updateState('filterSubject', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל התחומים</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={state.filterAudience}
          onChange={(e) => updateState('filterAudience', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל קהלי היעד</option>
          {audienceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={state.filterDay}
          onChange={(e) => updateState('filterDay', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל ימי הזמינות</option>
          {DAY_LABELS.map((label, idx) => (
            <option key={idx} value={String(idx)}>יום {label}</option>
          ))}
        </select>

        <select
          value={state.filterRatingMin}
          onChange={(e) => updateState('filterRatingMin', e.target.value)}
          className="h-9 px-2 border border-gray-300 rounded text-xs bg-white"
        >
          <option value="הכל">כל הציונים</option>
          <option value="3">3 ומעלה</option>
          <option value="4">4 ומעלה</option>
          <option value="4.5">4.5 ומעלה</option>
        </select>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
          <Upload className="w-3.5 h-3.5 ms-1" />
          ייבוא CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 ms-1" />
          ייצוא
        </Button>
        <Button variant="brand" size="sm" onClick={() => { setEditing(null); setAddOpen(true); }}>
          <Plus className="w-3.5 h-3.5 ms-1" />
          הוסף מדריך
        </Button>
      </div>

      {/* Table */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              לא נמצאו מדריכים תואמים את המסננים
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">שם מלא</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">תפקיד</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">טלפון</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">אימייל</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">עיר</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">אזור</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">תחומים</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">קהל יעד</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">זמינות</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">ציון</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">תעריף</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">עומס</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">סטטוס</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const regionColor = getRegionColor(r.region);
                    const load = r.profile_id ? loadByProfile[r.profile_id] : null;
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer"
                        onClick={() => navigate(`/crm/instructor/${r.id}`)}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">{r.full_name}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.role_type ? ROLE_TYPE_LABEL[r.role_type as keyof typeof ROLE_TYPE_LABEL] ?? r.role_type : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.phone ? (
                            <a
                              href={`tel:${r.phone}`}
                              className="inline-flex items-center gap-1 text-gray-700 hover:text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />
                              {r.phone}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.email ? (
                            <a
                              href={`mailto:${r.email}`}
                              className="inline-flex items-center gap-1 text-gray-700 hover:text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="w-3 h-3" />
                              {r.email}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{r.city || '—'}</td>
                        <td className="px-3 py-2">
                          {r.region ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${regionColor.badgeClass}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${regionColor.dotClass}`} />
                              {getRegionLabel(r.region)}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2"><ChipList items={r.subjects ?? []} color="blue" /></td>
                        <td className="px-3 py-2"><ChipList items={r.audiences ?? []} color="green" /></td>
                        <td className="px-3 py-2">
                          <AvailabilityCompact days={r.availability_days ?? []} hours={r.availability_hours} />
                        </td>
                        <td className="px-3 py-2"><Stars score={r.rating_score} /></td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatRate(r.hourly_rate)}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.profile_id !== null ? (load ?? 0) : '—'}
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2 text-left" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-gray-100">
                                <MoreVertical className="w-4 h-4 text-gray-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/crm/instructor/${r.id}`)}>
                                <Eye className="w-3.5 h-3.5 ms-2" />
                                צפייה
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditing(toRecord(r)); setAddOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5 ms-2" />
                                עריכה
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAssigning({ id: r.id, name: r.full_name, focus: 'institution' })}>
                                <Building2 className="w-3.5 h-3.5 ms-2" />
                                שיוך למוסד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAssigning({ id: r.id, name: r.full_name, focus: 'course' })}>
                                <BookOpen className="w-3.5 h-3.5 ms-2" />
                                שיוך לקורס
                              </DropdownMenuItem>
                              {r.status !== 'inactive' && (
                                <DropdownMenuItem onClick={() => markInactive(r.id)}>
                                  <UserX className="w-3.5 h-3.5 ms-2" />
                                  סמן כלא פעיל
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          סה״כ {filtered.length} מתוך {rows.length} מדריכים
        </div>
      </div>

      <AddInstructorModal
        open={addOpen}
        onOpenChange={setAddOpen}
        editing={editing}
        onSaved={() => fetchInstructors()}
      />
      <InstructorCsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onCompleted={fetchInstructors}
      />
      {assigning && (
        <AssignInstructorPlanningDialog
          open={true}
          onOpenChange={(o) => !o && setAssigning(null)}
          instructorId={assigning.id}
          instructorName={assigning.name}
          focus={assigning.focus}
          onAssigned={fetchInstructors}
        />
      )}
    </div>
  );
};

export default CRMInstructorsList;
