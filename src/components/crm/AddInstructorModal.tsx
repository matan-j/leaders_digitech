import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  REGIONS,
  getRegionByCity,
  getRegionColor,
  getRegionLabel,
  type RegionKey,
} from '@/lib/instructors/regions';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABEL,
  INSTRUCTOR_STATUSES,
  QUALITY_TAG_SUGGESTIONS,
  ROLE_TYPES,
  ROLE_TYPE_LABEL,
  STATUS_LABEL,
  splitList,
  validateInstructor,
  hasErrors,
  type InstructorStatus,
  type RoleType,
  type EmploymentType,
} from '@/lib/instructors/validation';

export interface InstructorRecord {
  id?: string;
  profile_id?: string | null;
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

const emptyRecord = (): InstructorRecord => ({
  full_name: '',
  role_type: 'instructor',
  phone: '',
  email: '',
  city: '',
  region: null,
  address: '',
  travel_radius_km: null,
  subjects: [],
  audiences: [],
  languages: [],
  availability_days: [],
  availability_hours: null,
  hourly_rate: null,
  hourly_rate_notes: '',
  employment_type: 'freelance',
  status: 'active',
  rating_score: null,
  rating_notes: '',
  quality_tags: [],
  notes: '',
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: InstructorRecord | null;
  onSaved?: (row: { id: string; full_name: string }) => void;
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const AddInstructorModal = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const [form, setForm] = useState<InstructorRecord>(emptyRecord());
  const [saving, setSaving] = useState(false);
  const [regionOverridden, setRegionOverridden] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ ...editing });
      setRegionOverridden(
        Boolean(editing.region) && editing.region !== getRegionByCity(editing.city)
      );
    } else {
      setForm(emptyRecord());
      setRegionOverridden(false);
    }
  }, [open, editing]);

  // Live city → region classification (only if user hasn't explicitly overridden).
  useEffect(() => {
    if (regionOverridden) return;
    const auto = getRegionByCity(form.city);
    if (auto !== (form.region ?? null)) {
      setForm((prev) => ({ ...prev, region: auto }));
    }
  }, [form.city, regionOverridden, form.region]);

  const update = <K extends keyof InstructorRecord>(field: K, value: InstructorRecord[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      availability_days: prev.availability_days.includes(day)
        ? prev.availability_days.filter((d) => d !== day)
        : [...prev.availability_days, day].sort(),
    }));
  };

  const toggleQualityTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      quality_tags: prev.quality_tags.includes(tag)
        ? prev.quality_tags.filter((t) => t !== tag)
        : [...prev.quality_tags, tag],
    }));
  };

  const handleSave = async () => {
    const issues = validateInstructor({
      full_name: form.full_name,
      city: form.city,
      phone: form.phone,
      email: form.email,
      hourly_rate: form.hourly_rate,
      travel_radius_km: form.travel_radius_km,
      rating_score: form.rating_score,
      status: form.status,
      region: form.region ?? undefined,
    });
    if (hasErrors(issues)) {
      const firstError = issues.find((i) => i.level === 'error');
      toast.error(firstError?.message ?? 'יש שגיאות בטופס');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        role_type: form.role_type || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim().toLowerCase() || null,
        city: form.city.trim(),
        region: form.region || null,
        address: form.address?.trim() || null,
        travel_radius_km: form.travel_radius_km,
        subjects: form.subjects,
        audiences: form.audiences,
        languages: form.languages,
        availability_days: form.availability_days,
        availability_hours: form.availability_hours,
        hourly_rate: form.hourly_rate,
        hourly_rate_notes: form.hourly_rate_notes?.trim() || null,
        employment_type: form.employment_type || null,
        status: form.status,
        rating_score: form.rating_score,
        rating_notes: form.rating_notes?.trim() || null,
        quality_tags: form.quality_tags,
        notes: form.notes?.trim() || null,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from('instructors')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('המדריך עודכן');
        onSaved?.({ id: editing.id, full_name: form.full_name });
      } else {
        const { data, error } = await supabase
          .from('instructors')
          .insert([payload])
          .select('id, full_name')
          .single();
        if (error) throw error;
        toast.success('המדריך נוסף');
        if (data) onSaved?.(data);
      }
      onOpenChange(false);
    } catch (err) {
      console.error('save instructor failed', err);
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      toast.error(`שמירה נכשלה: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const autoRegion = getRegionByCity(form.city);
  const regionColor = getRegionColor(form.region);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? 'עריכת מדריך' : 'הוספת מדריך / מרצה'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* General */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">פרטים כלליים</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="i-name">שם מלא *</Label>
                <Input
                  id="i-name"
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="i-role">תפקיד</Label>
                <select
                  id="i-role"
                  value={form.role_type ?? ''}
                  onChange={(e) => update('role_type', e.target.value as RoleType)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                >
                  {ROLE_TYPES.map((r) => (
                    <option key={r} value={r}>{ROLE_TYPE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="i-phone">טלפון</Label>
                <Input
                  id="i-phone"
                  value={form.phone ?? ''}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="050-1234567"
                />
              </div>
              <div>
                <Label htmlFor="i-email">אימייל</Label>
                <Input
                  id="i-email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="example@mail.com"
                />
              </div>
              <div>
                <Label htmlFor="i-status">סטטוס</Label>
                <select
                  id="i-status"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value as InstructorStatus)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                >
                  {INSTRUCTOR_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Region + availability */}
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">אזור וזמינות</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="i-city">עיר *</Label>
                <Input
                  id="i-city"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="תל אביב"
                />
                {form.city && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                    {form.region ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${regionColor.badgeClass}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${regionColor.dotClass}`} />
                        {getRegionLabel(form.region)}
                      </span>
                    ) : (
                      <span className="text-amber-700">עיר לא ממופה — הזן אזור ידנית.</span>
                    )}
                    {!regionOverridden && autoRegion && (
                      <span className="text-gray-500">סווג אוטומטית</span>
                    )}
                    <button
                      type="button"
                      className="text-blue-600 underline"
                      onClick={() => setRegionOverridden(true)}
                    >
                      שינוי אזור
                    </button>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="i-region">אזור</Label>
                <select
                  id="i-region"
                  value={form.region ?? ''}
                  disabled={!regionOverridden}
                  onChange={(e) => update('region', (e.target.value as RegionKey) || null)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">— ללא —</option>
                  {REGIONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
                {regionOverridden && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-gray-500 underline"
                    onClick={() => {
                      setRegionOverridden(false);
                      update('region', getRegionByCity(form.city));
                    }}
                  >
                    בטל override · החזר לסיווג אוטומטי
                  </button>
                )}
              </div>
              <div>
                <Label htmlFor="i-address">כתובת</Label>
                <Input
                  id="i-address"
                  value={form.address ?? ''}
                  onChange={(e) => update('address', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="i-radius">רדיוס נסיעה (ק"מ)</Label>
                <Input
                  id="i-radius"
                  type="number"
                  value={form.travel_radius_km ?? ''}
                  onChange={(e) =>
                    update(
                      'travel_radius_km',
                      e.target.value === '' ? null : parseInt(e.target.value, 10)
                    )
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>ימי זמינות</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {DAY_LABELS.map((label, idx) => {
                    const on = form.availability_days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={[
                          'w-9 h-9 rounded-full text-xs font-semibold border transition',
                          on
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="i-avh-from">שעת התחלה</Label>
                <Input
                  id="i-avh-from"
                  type="time"
                  value={form.availability_hours?.from ?? ''}
                  onChange={(e) =>
                    update('availability_hours', {
                      ...(form.availability_hours ?? {}),
                      from: e.target.value || undefined,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="i-avh-to">שעת סיום</Label>
                <Input
                  id="i-avh-to"
                  type="time"
                  value={form.availability_hours?.to ?? ''}
                  onChange={(e) =>
                    update('availability_hours', {
                      ...(form.availability_hours ?? {}),
                      to: e.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          </section>

          {/* Expertise */}
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">תחומי הדרכה</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>תחומים (מופרדים ב-;)</Label>
                <Input
                  value={form.subjects.join('; ')}
                  onChange={(e) => update('subjects', splitList(e.target.value))}
                  placeholder="מתמטיקה; מדעי המחשב; אנגלית"
                />
                {form.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.subjects.map((s) => (
                      <Badge key={s} variant="secondary" className="bg-blue-50 text-blue-700">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>קהל יעד (מופרד ב-;)</Label>
                <Input
                  value={form.audiences.join('; ')}
                  onChange={(e) => update('audiences', splitList(e.target.value))}
                  placeholder="יסודי; חט״ב; מורים; מנהלים"
                />
                {form.audiences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.audiences.map((s) => (
                      <Badge key={s} variant="secondary" className="bg-emerald-50 text-emerald-700">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>שפות (מופרדות ב-;)</Label>
                <Input
                  value={form.languages.join('; ')}
                  onChange={(e) => update('languages', splitList(e.target.value))}
                  placeholder="עברית; אנגלית; רוסית"
                />
              </div>
            </div>
          </section>

          {/* Rating */}
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">ציון ואיכות</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="i-rating">ציון (1-5)</Label>
                <Input
                  id="i-rating"
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={form.rating_score ?? ''}
                  onChange={(e) =>
                    update(
                      'rating_score',
                      e.target.value === '' ? null : parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="i-rating-notes">הערות לציון</Label>
                <Input
                  id="i-rating-notes"
                  value={form.rating_notes ?? ''}
                  onChange={(e) => update('rating_notes', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>תגיות איכות</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUALITY_TAG_SUGGESTIONS.map((tag) => {
                    const on = form.quality_tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleQualityTag(tag)}
                        className={[
                          'text-xs px-2.5 py-1 rounded-full border transition',
                          on
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300',
                        ].join(' ')}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {form.quality_tags.filter((t) => !QUALITY_TAG_SUGGESTIONS.includes(t)).length > 0 && (
                  <div className="mt-2 flex items-center flex-wrap gap-1.5">
                    {form.quality_tags
                      .filter((t) => !QUALITY_TAG_SUGGESTIONS.includes(t))
                      .map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700"
                        >
                          {t}
                          <button type="button" onClick={() => toggleQualityTag(t)}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
                <Input
                  className="mt-2"
                  placeholder="הוסף תגית חופשית ולחץ Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = e.currentTarget.value.trim();
                      if (v && !form.quality_tags.includes(v)) {
                        update('quality_tags', [...form.quality_tags, v]);
                      }
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700">תשלום ועלויות</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="i-rate">תעריף לשעה (₪)</Label>
                <Input
                  id="i-rate"
                  type="number"
                  value={form.hourly_rate ?? ''}
                  onChange={(e) =>
                    update(
                      'hourly_rate',
                      e.target.value === '' ? null : parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="i-employment">סוג העסקה</Label>
                <select
                  id="i-employment"
                  value={form.employment_type ?? ''}
                  onChange={(e) => update('employment_type', e.target.value as EmploymentType)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option value="">— בחר —</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EMPLOYMENT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="i-rate-notes">הערות לתעריף</Label>
                <Input
                  id="i-rate-notes"
                  value={form.hourly_rate_notes ?? ''}
                  onChange={(e) => update('hourly_rate_notes', e.target.value)}
                  placeholder="כולל נסיעות / משתנה לפי מרחק"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-4 border-t pt-4">
            <Label htmlFor="i-notes">הערות</Label>
            <Textarea
              id="i-notes"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value)}
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddInstructorModal;
