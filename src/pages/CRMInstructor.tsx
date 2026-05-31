import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Phone, Mail, MessageCircle, Pencil, Star, Loader2, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  getRegionColor, getRegionLabel,
} from '@/lib/instructors/regions';
import {
  EMPLOYMENT_TYPE_LABEL, ROLE_TYPE_LABEL, STATUS_BADGE, STATUS_LABEL,
  QUALITY_TAG_SUGGESTIONS,
  type EmploymentType, type InstructorStatus, type RoleType,
} from '@/lib/instructors/validation';
import AddInstructorModal, { type InstructorRecord } from '@/components/crm/AddInstructorModal';
import FindMatchingInstructorDialog from '@/components/crm/FindMatchingInstructorDialog';
import AssignInstructorPlanningDialog from '@/components/crm/AssignInstructorPlanningDialog';

interface Instructor extends InstructorRecord {
  id: string;
}

interface ActiveCourseInstance {
  id: string;
  start_date: string | null;
  end_date: string | null;
  course: { id: string; name: string } | null;
  institution: { id: string; name: string; city: string | null } | null;
}

interface PlanningAssignment {
  id: string;
  status: string;
  school_year: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  institution: { id: string; name: string; city: string | null } | null;
  course: { id: string; name: string } | null;
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const CRMInstructor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [editing, setEditing] = useState(false);
  const [findingMatch, setFindingMatch] = useState(false);

  // 5. Score & quality editable inline
  const [ratingScore, setRatingScore] = useState<string>('');
  const [ratingNotes, setRatingNotes] = useState<string>('');
  const [qualityTags, setQualityTags] = useState<string[]>([]);
  const [savingRating, setSavingRating] = useState(false);

  // 7. Notes editable inline
  const [notes, setNotes] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Active course instances when profile_id present
  const [activeCi, setActiveCi] = useState<ActiveCourseInstance[]>([]);
  const [planningAssignments, setPlanningAssignments] = useState<PlanningAssignment[]>([]);
  const [addingAssignment, setAddingAssignment] = useState(false);

  const fetchInstructor = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      toast.error('המדריך לא נמצא');
      setInstructor(null);
      setLoading(false);
      return;
    }
    const row = data as Instructor;
    setInstructor(row);
    setRatingScore(row.rating_score?.toString() ?? '');
    setRatingNotes(row.rating_notes ?? '');
    setQualityTags(row.quality_tags ?? []);
    setNotes(row.notes ?? '');
    setLoading(false);

    if (row.profile_id) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: ciRows } = await supabase
        .from('course_instances')
        .select('id, start_date, end_date, course:courses(id, name), institution:educational_institutions(id, name, city)')
        .eq('instructor_id', row.profile_id)
        .gte('end_date', todayIso)
        .order('start_date', { ascending: true });
      setActiveCi(((ciRows as unknown) as ActiveCourseInstance[]) ?? []);
    } else {
      setActiveCi([]);
    }

    const { data: paRows } = await supabase
      .from('instructor_assignments')
      .select('id, status, school_year, day_of_week, start_time, end_time, notes, institution:educational_institutions(id, name, city), course:courses(id, name)')
      .eq('instructor_id', row.id)
      .order('created_at', { ascending: false });
    setPlanningAssignments(((paRows as unknown) as PlanningAssignment[]) ?? []);
  };

  useEffect(() => {
    fetchInstructor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveRating = async () => {
    if (!instructor) return;
    const numeric = ratingScore.trim() === '' ? null : parseFloat(ratingScore);
    if (numeric !== null && (!Number.isFinite(numeric) || numeric < 1 || numeric > 5)) {
      toast.error('ציון חייב להיות בין 1 ל-5');
      return;
    }
    setSavingRating(true);
    const { error } = await supabase
      .from('instructors')
      .update({
        rating_score: numeric,
        rating_notes: ratingNotes.trim() || null,
        quality_tags: qualityTags,
      })
      .eq('id', instructor.id);
    setSavingRating(false);
    if (error) {
      toast.error('שמירה נכשלה');
      return;
    }
    toast.success('דירוג עודכן');
    setInstructor({ ...instructor, rating_score: numeric, rating_notes: ratingNotes, quality_tags: qualityTags });
  };

  const saveNotes = async () => {
    if (!instructor) return;
    if (notes === (instructor.notes ?? '')) return;
    setNotesSaving(true);
    const { error } = await supabase
      .from('instructors')
      .update({ notes: notes.trim() || null })
      .eq('id', instructor.id);
    setNotesSaving(false);
    if (error) {
      toast.error('שמירה נכשלה');
      return;
    }
    setInstructor({ ...instructor, notes });
  };

  const toggleTag = (t: string) => {
    setQualityTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const currentLoad = activeCi.length;

  const matchContext = useMemo(() => ({
    city: instructor?.city ?? null,
    region: instructor?.region ?? null,
    subjects: instructor?.subjects ?? [],
    audiences: instructor?.audiences ?? [],
  }), [instructor]);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!instructor) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-sm text-gray-600">המדריך לא נמצא</div>
        <Button variant="outline" onClick={() => navigate('/crm?tab=instructors')}>
          חזרה לרשימה
        </Button>
      </div>
    );
  }

  const regionColor = getRegionColor(instructor.region);
  const statusStyle = STATUS_BADGE[instructor.status as InstructorStatus] ?? { color: '#6B7280', bg: '#F3F4F6' };

  return (
    <div dir="rtl" className="bg-background min-h-screen pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <button
          className="text-xs text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1"
          onClick={() => navigate('/crm?tab=instructors')}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          חזרה לרשימת המדריכים
        </button>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-xl font-bold text-gray-900">{instructor.full_name}</h1>
              {instructor.role_type && (
                <Badge variant="outline" className="text-xs">
                  {ROLE_TYPE_LABEL[instructor.role_type as RoleType] ?? instructor.role_type}
                </Badge>
              )}
              {instructor.region && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${regionColor.badgeClass}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${regionColor.dotClass}`} />
                  {getRegionLabel(instructor.region)}
                </span>
              )}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ color: statusStyle.color, background: statusStyle.bg }}
              >
                {STATUS_LABEL[instructor.status as InstructorStatus] ?? instructor.status}
              </span>
              {instructor.rating_score !== null && (
                <span className="inline-flex items-center gap-0.5 text-amber-600 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" />
                  {instructor.rating_score.toFixed(1)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600">
              {instructor.city}
              {instructor.address ? ` · ${instructor.address}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {instructor.phone && (
              <>
                <a
                  href={`tel:${instructor.phone}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {instructor.phone}
                </a>
                <a
                  href={`https://wa.me/${instructor.phone.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-emerald-300 text-xs text-emerald-700 hover:bg-emerald-50"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </>
            )}
            {instructor.email && (
              <a
                href={`mailto:${instructor.email}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Mail className="w-3.5 h-3.5" />
                {instructor.email}
              </a>
            )}
            <Button variant="outline" size="sm" onClick={() => setFindingMatch(true)}>
              חיפוש שיבוץ תואם
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 ms-1" />
              ערוך
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <Tabs defaultValue="general" dir="rtl">
          <TabsList className="bg-white border border-gray-200 rounded-md p-1 flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="general">פרטים כלליים</TabsTrigger>
            <TabsTrigger value="region">אזור וזמינות</TabsTrigger>
            <TabsTrigger value="expertise">תחומי הדרכה</TabsTrigger>
            <TabsTrigger value="assignments">שיבוצים ופעילות</TabsTrigger>
            <TabsTrigger value="quality">ציון ואיכות</TabsTrigger>
            <TabsTrigger value="payment">תשלום ועלויות</TabsTrigger>
            <TabsTrigger value="docs">מסמכים והערות</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="bg-white border border-gray-200 rounded-md p-5 mt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <FieldRow label="שם מלא" value={instructor.full_name} />
              <FieldRow label="תפקיד" value={instructor.role_type ? ROLE_TYPE_LABEL[instructor.role_type as RoleType] ?? instructor.role_type : '—'} />
              <FieldRow label="טלפון" value={instructor.phone ?? '—'} />
              <FieldRow label="אימייל" value={instructor.email ?? '—'} />
              <FieldRow label="סטטוס" value={STATUS_LABEL[instructor.status as InstructorStatus] ?? instructor.status} />
              <FieldRow label="קישור למשתמש מערכת" value={instructor.profile_id ? 'מקושר' : '—'} />
            </div>
          </TabsContent>

          <TabsContent value="region" className="bg-white border border-gray-200 rounded-md p-5 mt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <FieldRow label="עיר" value={instructor.city} />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs w-32 shrink-0">אזור</span>
                {instructor.region ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${regionColor.badgeClass}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${regionColor.dotClass}`} />
                    {getRegionLabel(instructor.region)}
                  </span>
                ) : <span className="text-gray-400">—</span>}
              </div>
              <FieldRow label="כתובת" value={instructor.address ?? '—'} />
              <FieldRow label="רדיוס נסיעה" value={instructor.travel_radius_km ? `${instructor.travel_radius_km} ק"מ` : '—'} />
              <div>
                <div className="text-gray-500 text-xs mb-1">ימי זמינות</div>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, idx) => (
                    <span
                      key={idx}
                      className={[
                        'w-7 h-7 rounded inline-flex items-center justify-center text-[11px] font-semibold',
                        (instructor.availability_days ?? []).includes(idx)
                          ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300',
                      ].join(' ')}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <FieldRow
                label="טווח שעות"
                value={
                  instructor.availability_hours?.from && instructor.availability_hours?.to
                    ? `${instructor.availability_hours.from}–${instructor.availability_hours.to}`
                    : '—'
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="expertise" className="bg-white border border-gray-200 rounded-md p-5 mt-3 space-y-4">
            <Section title="תחומים">
              <ChipRow items={instructor.subjects} color="bg-blue-50 text-blue-700" />
            </Section>
            <Section title="קהל יעד">
              <ChipRow items={instructor.audiences} color="bg-emerald-50 text-emerald-700" />
            </Section>
            <Section title="שפות">
              <ChipRow items={instructor.languages} color="bg-gray-100 text-gray-700" />
            </Section>
          </TabsContent>

          <TabsContent value="assignments" className="bg-white border border-gray-200 rounded-md p-5 mt-3 space-y-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-gray-700">שיבוצים פעילים (קורסים בפועל)</h3>
              <span className="text-xs text-gray-500">עומס נוכחי: {currentLoad}</span>
            </div>
            {!instructor.profile_id ? (
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                מדריך זה אינו מקושר למשתמש מערכת — לא ניתן להציג שיבוצים מבוססי <code>course_instances</code>.
              </div>
            ) : activeCi.length === 0 ? (
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">אין שיבוצים פעילים.</div>
            ) : (
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">קורס</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">מוסד</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">עיר</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">התחלה</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">סיום</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeCi.map((ci) => (
                      <tr key={ci.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{ci.course?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-800">{ci.institution?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{ci.institution?.city ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{ci.start_date ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{ci.end_date ?? '—'}</td>
                        <td className="px-3 py-2 text-left">
                          {ci.institution?.id && (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              onClick={() => navigate(`/crm/institution/${ci.institution!.id}`)}
                            >
                              פתח <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">שיבוצי תכנון</h3>
                <Button size="sm" variant="outline" onClick={() => setAddingAssignment(true)}>
                  + הוסף שיבוץ
                </Button>
              </div>
              {planningAssignments.length === 0 ? (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                  אין שיבוצי תכנון. לחץ "הוסף שיבוץ" כדי לקשר את המדריך למוסד / קורס לשנה"ל הקרובה.
                </div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">מוסד</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">קורס</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">שנה"ל</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">יום</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">שעות</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planningAssignments.map((pa) => (
                        <tr key={pa.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800">{pa.institution?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-800">{pa.course?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{pa.school_year ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {pa.day_of_week !== null ? DAY_LABELS[pa.day_of_week] : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {pa.start_time && pa.end_time ? `${pa.start_time}–${pa.end_time}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{pa.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="quality" className="bg-white border border-gray-200 rounded-md p-5 mt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <Label htmlFor="rating-score">ציון (1-5)</Label>
                <Input
                  id="rating-score"
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={ratingScore}
                  onChange={(e) => setRatingScore(e.target.value)}
                  placeholder="טרם דורג"
                />
              </div>
              <div>
                <Label htmlFor="rating-notes">הערות לציון</Label>
                <Input
                  id="rating-notes"
                  value={ratingNotes}
                  onChange={(e) => setRatingNotes(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>תגיות איכות</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUALITY_TAG_SUGGESTIONS.map((t) => {
                    const on = qualityTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={[
                          'text-xs px-2.5 py-1 rounded-full border transition',
                          on ? 'bg-purple-100 text-purple-800 border-purple-300'
                             : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300',
                        ].join(' ')}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                {qualityTags.filter((t) => !QUALITY_TAG_SUGGESTIONS.includes(t)).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {qualityTags
                      .filter((t) => !QUALITY_TAG_SUGGESTIONS.includes(t))
                      .map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          {t}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="col-span-2 flex justify-end">
                <Button variant="brand" size="sm" onClick={saveRating} disabled={savingRating}>
                  {savingRating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'שמור דירוג'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="bg-white border border-gray-200 rounded-md p-5 mt-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <FieldRow
                label="תעריף לשעה"
                value={instructor.hourly_rate !== null ? `₪${instructor.hourly_rate.toLocaleString('he-IL')} / שעה` : '—'}
              />
              <FieldRow label="סוג העסקה" value={instructor.employment_type ? EMPLOYMENT_TYPE_LABEL[instructor.employment_type as EmploymentType] ?? instructor.employment_type : '—'} />
              <FieldRow label="הערות לתעריף" value={instructor.hourly_rate_notes ?? '—'} />
            </div>
          </TabsContent>

          <TabsContent value="docs" className="bg-white border border-gray-200 rounded-md p-5 mt-3 space-y-5">
            <div>
              <Label htmlFor="instructor-notes">הערות</Label>
              <Textarea
                id="instructor-notes"
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
              />
              {notesSaving && <div className="text-[11px] text-gray-500 mt-1">שומר…</div>}
            </div>
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
              העלאת מסמכים — בקרוב.
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AddInstructorModal
        open={editing}
        onOpenChange={setEditing}
        editing={instructor}
        onSaved={() => {
          setEditing(false);
          fetchInstructor();
        }}
      />

      <FindMatchingInstructorDialog
        open={findingMatch}
        onOpenChange={setFindingMatch}
        context={matchContext}
        excludeInstructorId={instructor.id}
        title="מדריכים דומים / שיבוצים תואמים"
        onSelect={(otherId) => {
          setFindingMatch(false);
          navigate(`/crm/instructor/${otherId}`);
        }}
      />

      <AssignInstructorPlanningDialog
        open={addingAssignment}
        onOpenChange={setAddingAssignment}
        instructorId={instructor.id}
        instructorName={instructor.full_name}
        focus="institution"
        onAssigned={fetchInstructor}
      />
    </div>
  );
};

const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-gray-500 text-xs w-32 shrink-0">{label}</span>
    <span className="text-gray-800">{value}</span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
    {children}
  </div>
);

const ChipRow = ({ items, color }: { items: string[]; color: string }) => {
  if (!items?.length) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className={`text-xs px-2.5 py-0.5 rounded-full ${color}`}>{s}</span>
      ))}
    </div>
  );
};

export default CRMInstructor;
