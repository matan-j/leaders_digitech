import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  GROUP_SCHEDULING_STATUS_LABELS,
  ORDER_AUDIT_ACTION_LABELS,
  ORDER_SCHEDULING_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AcademicYearOrderAudit,
  type AcademicYearOrderAuditAction,
  type AcademicYearOrderGroupPayload,
  type AcademicYearOrderGroupSchedulingStatus,
  type AcademicYearOrderPayload,
  type AcademicYearOrderSchedulingStatus,
  type AcademicYearOrderStatus,
  type TimeWindow,
} from '@/types/academicYearOrders';
import { ACADEMIC_YEARS, currentAcademicYear } from '@/lib/academicYearOrders/academic-years';
import { REGIONS } from '@/lib/academicYearOrders/regions';
import {
  getOrderWithGroups,
  linkGroupInstance,
  listAuditByOrder,
  listGroupInstances,
  listInstitutionCourseInstances,
  saveAcademicYearOrder,
  unlinkGroupInstance,
  type CourseInstanceSummary,
} from '@/lib/academicYearOrders/api';
import type { AcademicYearOrderGroupInstance } from '@/types/academicYearOrders';

import { emptyGroup, type GroupFormValue, type OrderFormValues } from './order-form-types';

const NULL_SELECT = '__none__';

const DAY_LABELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
];

const isoDate = (d: string | null): string => (d ? d.slice(0, 10) : '');

const toNullableNumber = (s: string): number | null => {
  if (s === '' || s === null || s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const toNullableString = (s: string): string | null => {
  const trimmed = s?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

interface InstructorOption {
  id: string;
  full_name: string;
}

interface CourseOption {
  id: string;
  name: string;
}

interface Props {
  institutionId: string;
  institutionName: string;
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (orderId: string) => void;
  // Pre-fill the source link when creating a new order from a quote/opportunity.
  initialSourceQuoteId?: string | null;
  initialSourceOpportunityId?: string | null;
}

const AcademicYearOrderEditorSheet: React.FC<Props> = ({
  institutionId,
  institutionName,
  orderId,
  open,
  onOpenChange,
  onSaved,
  initialSourceQuoteId,
  initialSourceOpportunityId,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isEdit = Boolean(orderId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'groups' | 'audit'>('details');
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [sourceQuoteId, setSourceQuoteId] = useState<string | null>(null);
  const [sourceOpportunityId, setSourceOpportunityId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AcademicYearOrderAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [availableInstances, setAvailableInstances] = useState<CourseInstanceSummary[]>([]);
  const [groupLinks, setGroupLinks] = useState<Record<string, AcademicYearOrderGroupInstance[]>>({});

  const form = useForm<OrderFormValues>({
    defaultValues: {
      academic_year: currentAcademicYear(),
      status: 'draft',
      scheduling_status: 'not_started',
      region: '',
      city: '',
      preferred_instructor_id: '',
      requested_start_date: '',
      requested_end_date: '',
      groups_count_planned: '',
      total_meetings_planned: '',
      hours_per_meeting: '',
      notes: '',
      groups: [],
    },
  });

  const { control, register, handleSubmit, reset, watch, formState } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'groups',
  });

  const watchedStatus = watch('status');
  const watchedGroupsCount = fields.length;

  const loadAudit = async (oid: string) => {
    setAuditLoading(true);
    try {
      const entries = await listAuditByOrder(oid);
      setAuditEntries(entries);

      const userIds = Array.from(
        new Set(entries.map((e) => e.user_id).filter((id): id is string => Boolean(id)))
      );
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (!error && data) {
          const map: Record<string, string> = {};
          for (const p of data) map[p.id] = p.full_name ?? '—';
          setUserNames(map);
        }
      }
    } catch (e) {
      const err = e as { message?: string };
      toast({
        title: 'שגיאה בטעינת היסטוריה',
        description: err.message ?? 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const handleTabChange = (v: string) => {
    const next = v as 'details' | 'groups' | 'audit';
    setActiveTab(next);
    if (next === 'audit' && orderId && auditEntries.length === 0 && !auditLoading) {
      void loadAudit(orderId);
    }
  };

  const handleLinkInstance = async (groupId: string, courseInstanceId: string) => {
    try {
      const newLink = await linkGroupInstance(groupId, courseInstanceId);
      setGroupLinks((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), newLink],
      }));
      toast({ title: 'השיבוץ נקשר' });
    } catch (e) {
      const err = e as { message?: string };
      toast({
        title: 'שגיאה בקישור שיבוץ',
        description: err.message ?? 'נסה שוב',
        variant: 'destructive',
      });
    }
  };

  const handleUnlinkInstance = async (groupId: string, linkId: string) => {
    try {
      await unlinkGroupInstance(linkId);
      setGroupLinks((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((l) => l.id !== linkId),
      }));
      toast({ title: 'השיבוץ נותק' });
    } catch (e) {
      const err = e as { message?: string };
      toast({
        title: 'שגיאה בניתוק שיבוץ',
        description: err.message ?? 'נסה שוב',
        variant: 'destructive',
      });
    }
  };

  // ── Load reference data once when the sheet opens ─────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [instructorsRes, coursesRes, instancesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'instructor')
          .order('full_name', { ascending: true }),
        supabase
          .from('courses')
          .select('id, name')
          .eq('is_visible', true)
          .order('name', { ascending: true }),
        listInstitutionCourseInstances(institutionId).catch(() => [] as CourseInstanceSummary[]),
      ]);

      if (cancelled) return;

      if (!instructorsRes.error && instructorsRes.data) {
        setInstructors(
          instructorsRes.data.map((r) => ({ id: r.id, full_name: r.full_name ?? '—' }))
        );
      }
      if (!coursesRes.error && coursesRes.data) {
        setCourses(coursesRes.data.map((r) => ({ id: r.id, name: r.name ?? '—' })));
      }
      setAvailableInstances(instancesRes);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, institutionId]);

  // ── Hydrate form when opening (edit) or reset to defaults (create) ────────
  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    setAuditEntries([]);
    setUserNames({});
    setGroupLinks({});

    if (!orderId) {
      reset({
        academic_year: currentAcademicYear(),
        status: 'draft',
        scheduling_status: 'not_started',
        region: '',
        city: '',
        preferred_instructor_id: '',
        requested_start_date: '',
        requested_end_date: '',
        groups_count_planned: '',
        total_meetings_planned: '',
        hours_per_meeting: '',
        notes: '',
        groups: [],
      });
      setSourceQuoteId(initialSourceQuoteId ?? null);
      setSourceOpportunityId(initialSourceOpportunityId ?? null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getOrderWithGroups(orderId);
        if (cancelled || !data) return;

        const { order, groups } = data;
        const timeWindow = (g: (typeof groups)[number]): TimeWindow | null => {
          const tw = g.requested_time_window as TimeWindow | null;
          return tw && typeof tw === 'object' && 'from' in tw && 'to' in tw ? tw : null;
        };

        reset({
          academic_year: order.academic_year,
          status: order.status as AcademicYearOrderStatus,
          scheduling_status: order.scheduling_status as AcademicYearOrderSchedulingStatus,
          region: order.region ?? '',
          city: order.city ?? '',
          preferred_instructor_id: order.preferred_instructor_id ?? '',
          requested_start_date: isoDate(order.requested_start_date),
          requested_end_date: isoDate(order.requested_end_date),
          groups_count_planned: order.groups_count_planned?.toString() ?? '',
          total_meetings_planned: order.total_meetings_planned?.toString() ?? '',
          hours_per_meeting: order.hours_per_meeting?.toString() ?? '',
          notes: order.notes ?? '',
          groups: groups.map((g): GroupFormValue => {
            const tw = timeWindow(g);
            return {
              id: g.id,
              course_id: g.course_id,
              age_group: g.age_group ?? '',
              grade_label: g.grade_label ?? '',
              groups_count: g.groups_count ?? 1,
              meetings_count: g.meetings_count?.toString() ?? '',
              hours_per_meeting: g.hours_per_meeting?.toString() ?? '',
              requested_days_of_week: (g.requested_days_of_week as number[] | null) ?? [],
              time_from: tw?.from ?? '',
              time_to: tw?.to ?? '',
              scheduling_status: (g.scheduling_status ??
                'pending') as AcademicYearOrderGroupSchedulingStatus,
              notes: g.notes ?? '',
            };
          }),
        });

        setSourceQuoteId(order.source_quote_id);
        setSourceOpportunityId(order.source_opportunity_id);

        // Phase 8: load existing scheduling links for these groups.
        const groupIds = groups.map((g) => g.id);
        if (groupIds.length > 0) {
          try {
            const links = await listGroupInstances(groupIds);
            const map: Record<string, AcademicYearOrderGroupInstance[]> = {};
            for (const link of links) {
              (map[link.group_id] ??= []).push(link);
            }
            if (!cancelled) setGroupLinks(map);
          } catch {
            // Silently fail — scheduling section will just show as empty.
          }
        }
      } catch (e) {
        const err = e as { message?: string };
        toast({
          title: 'שגיאה בטעינת ההזמנה',
          description: err.message ?? 'נסה שוב',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (values: OrderFormValues) => {
    // Client-side date sanity check
    if (
      values.requested_start_date &&
      values.requested_end_date &&
      values.requested_end_date < values.requested_start_date
    ) {
      toast({
        title: 'תאריכים לא תקינים',
        description: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.',
        variant: 'destructive',
      });
      setActiveTab('details');
      return;
    }

    // Group-level time window sanity check
    for (let i = 0; i < values.groups.length; i++) {
      const g = values.groups[i];
      if (g.time_from && g.time_to && g.time_to <= g.time_from) {
        toast({
          title: 'שעות לא תקינות',
          description: `קבוצה ${i + 1}: שעת הסיום חייבת להיות אחרי שעת ההתחלה.`,
          variant: 'destructive',
        });
        setActiveTab('groups');
        return;
      }
    }

    const groupsPayload: AcademicYearOrderGroupPayload[] = values.groups.map(
      (g, idx): AcademicYearOrderGroupPayload => {
        const tw: TimeWindow | null =
          g.time_from && g.time_to ? { from: g.time_from, to: g.time_to } : null;
        return {
          id: g.id ?? null,
          course_id: g.course_id,
          age_group: toNullableString(g.age_group),
          grade_label: toNullableString(g.grade_label),
          groups_count: g.groups_count || 1,
          requested_days_of_week:
            g.requested_days_of_week && g.requested_days_of_week.length > 0
              ? g.requested_days_of_week
              : null,
          requested_time_window: tw,
          meetings_count: toNullableNumber(g.meetings_count),
          hours_per_meeting: toNullableNumber(g.hours_per_meeting),
          scheduling_status: g.scheduling_status,
          sort_order: idx,
          notes: toNullableString(g.notes),
        };
      }
    );

    const payload: AcademicYearOrderPayload = {
      id: orderId ?? null,
      institution_id: institutionId,
      academic_year: values.academic_year,
      status: values.status,
      source_quote_id: sourceQuoteId,
      source_opportunity_id: sourceOpportunityId,
      groups_count_planned: toNullableNumber(values.groups_count_planned),
      total_meetings_planned: toNullableNumber(values.total_meetings_planned),
      hours_per_meeting: toNullableNumber(values.hours_per_meeting),
      city: toNullableString(values.city),
      region: toNullableString(values.region),
      preferred_instructor_id: values.preferred_instructor_id || null,
      requested_start_date: values.requested_start_date || null,
      requested_end_date: values.requested_end_date || null,
      scheduling_status: values.scheduling_status,
      notes: toNullableString(values.notes),
      groups: groupsPayload,
    };

    setSaving(true);
    try {
      const result = await saveAcademicYearOrder(payload);
      toast({
        title: isEdit ? 'ההזמנה עודכנה' : 'ההזמנה נוצרה',
      });
      onSaved(result.order_id);
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast({
        title: 'שגיאה בשמירה',
        description: err.message ?? 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const sourceChip = useMemo(() => {
    if (sourceQuoteId) {
      return {
        label: 'נוצר מהצעה',
        onClick: () => {
          onOpenChange(false);
          navigate(`/crm/institution/${institutionId}?tab=quotes`);
        },
      };
    }
    if (sourceOpportunityId) {
      return {
        label: 'נוצר מהזדמנות',
        onClick: () => {
          onOpenChange(false);
          navigate(`/crm/institution/${institutionId}?tab=opportunities`);
        },
      };
    }
    return null;
  }, [sourceQuoteId, sourceOpportunityId, institutionId, navigate, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-[720px] !max-w-[720px] flex flex-col p-0 overflow-hidden"
      >
        <div dir="rtl" className="flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-right text-lg font-bold text-gray-900">
              {isEdit ? 'עריכת הזמנה לשנה"ל' : 'הזמנה חדשה לשנה"ל'}
            </SheetTitle>
            <div className="text-right text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span>{institutionName}</span>
              {sourceChip && (
                <button
                  type="button"
                  onClick={sourceChip.onClick}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  {sourceChip.label}
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
              <Badge variant="outline">{ORDER_STATUS_LABELS[watchedStatus]}</Badge>
            </div>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              טוען...
            </div>
          ) : (
            <FormProvider {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                <Tabs
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <div className="px-6 pt-3 border-b">
                    <TabsList>
                      <TabsTrigger value="details">פרטי הזמנה</TabsTrigger>
                      <TabsTrigger value="groups">
                        קבוצות {watchedGroupsCount > 0 ? `(${watchedGroupsCount})` : ''}
                      </TabsTrigger>
                      {isEdit && <TabsTrigger value="audit">היסטוריה</TabsTrigger>}
                    </TabsList>
                  </div>

                  <TabsContent
                    value="details"
                    className="flex-1 overflow-y-auto px-6 py-5 m-0 data-[state=inactive]:hidden"
                    forceMount
                  >
                    <DetailsTab instructors={instructors} control={control} register={register} />
                  </TabsContent>

                  <TabsContent
                    value="groups"
                    className="flex-1 overflow-y-auto px-6 py-5 m-0 data-[state=inactive]:hidden"
                    forceMount
                  >
                    <GroupsTab
                      fields={fields}
                      append={append}
                      remove={remove}
                      move={move}
                      courses={courses}
                      control={control}
                      register={register}
                      availableInstances={availableInstances}
                      groupLinks={groupLinks}
                      onLink={handleLinkInstance}
                      onUnlink={handleUnlinkInstance}
                    />
                  </TabsContent>

                  {isEdit && (
                    <TabsContent
                      value="audit"
                      className="flex-1 overflow-y-auto px-6 py-5 m-0 data-[state=inactive]:hidden"
                      forceMount
                    >
                      <AuditTab
                        loading={auditLoading}
                        entries={auditEntries}
                        userNames={userNames}
                      />
                    </TabsContent>
                  )}
                </Tabs>

                <SheetFooter className="px-6 py-4 border-t bg-gray-50 flex-row justify-end gap-2 sm:space-x-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    ביטול
                  </Button>
                  <Button type="submit" disabled={saving || !formState.isDirty && isEdit}>
                    {saving ? (
                      <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="ms-2 h-4 w-4" />
                    )}
                    {isEdit ? 'שמור שינויים' : 'צור הזמנה'}
                  </Button>
                </SheetFooter>
              </form>
            </FormProvider>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ─── Details Tab ──────────────────────────────────────────────────────────────

interface DetailsTabProps {
  instructors: InstructorOption[];
  control: ReturnType<typeof useForm<OrderFormValues>>['control'];
  register: ReturnType<typeof useForm<OrderFormValues>>['register'];
}

const DetailsTab: React.FC<DetailsTabProps> = ({ instructors, control, register }) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow label="שנה״ל" required>
          <Controller
            control={control}
            name="academic_year"
            rules={{ required: true }}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="סטטוס">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ORDER_STATUS_LABELS) as [AcademicYearOrderStatus, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="מצב שיבוץ">
          <Controller
            control={control}
            name="scheduling_status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ORDER_SCHEDULING_STATUS_LABELS) as [
                    AcademicYearOrderSchedulingStatus,
                    string,
                  ][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="אזור">
          <Controller
            control={control}
            name="region"
            render={({ field }) => (
              <Select
                value={field.value === '' ? NULL_SELECT : field.value}
                onValueChange={(v) => field.onChange(v === NULL_SELECT ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_SELECT}>ללא</SelectItem>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="עיר">
          <Input {...register('city')} placeholder="לדוגמה: תל אביב" />
        </FieldRow>

        <FieldRow label="מדריך מועדף">
          <Controller
            control={control}
            name="preferred_instructor_id"
            render={({ field }) => (
              <Select
                value={field.value === '' ? NULL_SELECT : field.value}
                onValueChange={(v) => field.onChange(v === NULL_SELECT ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_SELECT}>ללא</SelectItem>
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="תאריך התחלה מבוקש">
          <Input type="date" {...register('requested_start_date')} />
        </FieldRow>

        <FieldRow label="תאריך סיום מבוקש">
          <Input type="date" {...register('requested_end_date')} />
        </FieldRow>

        <FieldRow label="קבוצות מתוכננות" hint="ישלים את חישוב הקבוצות בפועל">
          <Input type="number" min={0} {...register('groups_count_planned')} placeholder="—" />
        </FieldRow>

        <FieldRow label="סך מפגשים מתוכננים">
          <Input type="number" min={0} {...register('total_meetings_planned')} placeholder="—" />
        </FieldRow>

        <FieldRow label="שעות למפגש" hint="ערך ברירת מחדל ברמת ההזמנה">
          <Input type="number" min={0} step="0.25" {...register('hours_per_meeting')} placeholder="—" />
        </FieldRow>
      </div>

      <FieldRow label="הערות">
        <Textarea {...register('notes')} rows={4} placeholder="פרטים כלליים על ההזמנה..." />
      </FieldRow>
    </div>
  );
};

// ─── Groups Tab ───────────────────────────────────────────────────────────────

interface GroupsTabProps {
  fields: Array<GroupFormValue & { id: string }>;
  append: (g: GroupFormValue) => void;
  remove: (idx: number) => void;
  move: (from: number, to: number) => void;
  courses: CourseOption[];
  control: ReturnType<typeof useForm<OrderFormValues>>['control'];
  register: ReturnType<typeof useForm<OrderFormValues>>['register'];
  availableInstances: CourseInstanceSummary[];
  groupLinks: Record<string, AcademicYearOrderGroupInstance[]>;
  onLink: (groupId: string, courseInstanceId: string) => Promise<void>;
  onUnlink: (groupId: string, linkId: string) => Promise<void>;
}

const GroupsTab: React.FC<GroupsTabProps> = ({
  fields,
  append,
  remove,
  move,
  courses,
  control,
  register,
  availableInstances,
  groupLinks,
  onLink,
  onUnlink,
}) => {
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg bg-white">
        <p className="text-sm text-gray-500 mb-4">
          אין עדיין קבוצות בהזמנה זו. הוסיפו קבוצה ראשונה כדי להתחיל לתכנן את הפעילות השנתית.
        </p>
        <Button type="button" onClick={() => append(emptyGroup())}>
          <Plus className="ms-2 h-4 w-4" />
          הוסף קבוצה
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">סך {fields.length} קבוצות</p>
        <Button type="button" size="sm" onClick={() => append(emptyGroup())}>
          <Plus className="ms-1 h-4 w-4" />
          הוסף קבוצה
        </Button>
      </div>

      {fields.map((field, idx) => (
        <GroupCard
          key={field.id}
          idx={idx}
          totalCount={fields.length}
          control={control}
          register={register}
          courses={courses}
          onRemove={() => remove(idx)}
          onMoveUp={() => idx > 0 && move(idx, idx - 1)}
          onMoveDown={() => idx < fields.length - 1 && move(idx, idx + 1)}
          groupLinks={groupLinks}
          availableInstances={availableInstances}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      ))}
    </div>
  );
};

interface GroupCardProps {
  idx: number;
  totalCount: number;
  control: ReturnType<typeof useForm<OrderFormValues>>['control'];
  register: ReturnType<typeof useForm<OrderFormValues>>['register'];
  courses: CourseOption[];
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  groupLinks: Record<string, AcademicYearOrderGroupInstance[]>;
  availableInstances: CourseInstanceSummary[];
  onLink: (groupId: string, courseInstanceId: string) => Promise<void>;
  onUnlink: (groupId: string, linkId: string) => Promise<void>;
}

const GroupCard: React.FC<GroupCardProps> = ({
  idx,
  totalCount,
  control,
  register,
  courses,
  onRemove,
  onMoveUp,
  onMoveDown,
  groupLinks,
  availableInstances,
  onLink,
  onUnlink,
}) => {
  const base = `groups.${idx}` as const;

  // The persisted DB id (null for groups that haven't been saved yet)
  const persistedId = useWatch({ control, name: `${base}.id` }) as string | null;
  const links = persistedId ? groupLinks[persistedId] ?? [] : [];

  return (
    <div className="border rounded-lg bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">קבוצה {idx + 1}</h4>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={idx === 0}
            onClick={onMoveUp}
            title="הזז למעלה"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={idx === totalCount - 1}
            onClick={onMoveDown}
            title="הזז למטה"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            title="מחיקה"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="קורס">
          <Controller
            control={control}
            name={`${base}.course_id`}
            render={({ field }) => (
              <Select
                value={field.value ?? NULL_SELECT}
                onValueChange={(v) => field.onChange(v === NULL_SELECT ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="ללא קורס" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_SELECT}>ללא קורס</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>

        <FieldRow label="שכבת גיל">
          <Input {...register(`${base}.age_group`)} placeholder="לדוגמה: ג'-ד'" />
        </FieldRow>

        <FieldRow label="תווית כיתה">
          <Input {...register(`${base}.grade_label`)} placeholder="לדוגמה: תיכון" />
        </FieldRow>

        <FieldRow label="מספר קבוצות מקבילות">
          <Input
            type="number"
            min={1}
            {...register(`${base}.groups_count`, { valueAsNumber: true })}
          />
        </FieldRow>

        <FieldRow label="מפגשים">
          <Input type="number" min={0} {...register(`${base}.meetings_count`)} placeholder="—" />
        </FieldRow>

        <FieldRow label="שעות למפגש">
          <Input
            type="number"
            min={0}
            step="0.25"
            {...register(`${base}.hours_per_meeting`)}
            placeholder="—"
          />
        </FieldRow>

        <FieldRow label="שעת התחלה">
          <Input type="time" {...register(`${base}.time_from`)} />
        </FieldRow>

        <FieldRow label="שעת סיום">
          <Input type="time" {...register(`${base}.time_to`)} />
        </FieldRow>

        <FieldRow label="סטטוס שיבוץ">
          <Controller
            control={control}
            name={`${base}.scheduling_status`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(GROUP_SCHEDULING_STATUS_LABELS) as [
                    AcademicYearOrderGroupSchedulingStatus,
                    string,
                  ][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldRow>
      </div>

      <FieldRow label="ימים מבוקשים">
        <Controller
          control={control}
          name={`${base}.requested_days_of_week`}
          render={({ field }) => {
            const selected = field.value ?? [];
            const toggle = (day: number) => {
              const next = selected.includes(day)
                ? selected.filter((d) => d !== day)
                : [...selected, day].sort((a, b) => a - b);
              field.onChange(next);
            };
            return (
              <div className="flex flex-wrap gap-3">
                {DAY_LABELS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(d.value)}
                      onCheckedChange={() => toggle(d.value)}
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            );
          }}
        />
      </FieldRow>

      <FieldRow label="הערות לקבוצה">
        <Textarea {...register(`${base}.notes`)} rows={2} placeholder="..." />
      </FieldRow>

      <GroupSchedulingSection
        persistedId={persistedId}
        links={links}
        availableInstances={availableInstances}
        onLink={onLink}
        onUnlink={onUnlink}
      />
    </div>
  );
};

// ─── Group scheduling section (Phase 8) ───────────────────────────────────────

interface GroupSchedulingSectionProps {
  persistedId: string | null;
  links: AcademicYearOrderGroupInstance[];
  availableInstances: CourseInstanceSummary[];
  onLink: (groupId: string, courseInstanceId: string) => Promise<void>;
  onUnlink: (groupId: string, linkId: string) => Promise<void>;
}

const GroupSchedulingSection: React.FC<GroupSchedulingSectionProps> = ({
  persistedId,
  links,
  availableInstances,
  onLink,
  onUnlink,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const linkedIds = useMemo(() => new Set(links.map((l) => l.course_instance_id)), [links]);
  const pickable = useMemo(
    () => availableInstances.filter((i) => !linkedIds.has(i.id)),
    [availableInstances, linkedIds]
  );

  const instanceById = useMemo(() => {
    const m = new Map<string, CourseInstanceSummary>();
    for (const i of availableInstances) m.set(i.id, i);
    return m;
  }, [availableInstances]);

  const handleLinkClick = async (courseInstanceId: string) => {
    if (!persistedId) return;
    setBusy(true);
    try {
      await onLink(persistedId, courseInstanceId);
      setPickerOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlinkClick = async (linkId: string) => {
    if (!persistedId) return;
    setBusy(true);
    try {
      await onUnlink(persistedId, linkId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-3 mt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-bold text-gray-700">
          שיבוצים {links.length > 0 ? `(${links.length})` : ''}
        </Label>
        {persistedId && pickable.length > 0 && !pickerOpen && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={busy}
          >
            <Plus className="ms-1 h-3.5 w-3.5" />
            קשר שיבוץ
          </Button>
        )}
      </div>

      {!persistedId && (
        <p className="text-[11px] text-gray-500">
          שמור את הקבוצה כדי לקשר אליה שיבוצים (כיתות בפועל).
        </p>
      )}

      {persistedId && links.length === 0 && !pickerOpen && (
        <p className="text-[11px] text-gray-500">
          {pickable.length === 0
            ? 'אין שיבוצים זמינים למוסד זה. צרו תחילה כיתה ב"שיבוצים".'
            : 'עדיין לא נקשר שיבוץ לקבוצה זו.'}
        </p>
      )}

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link) => {
            const inst = instanceById.get(link.course_instance_id);
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 text-xs border rounded bg-gray-50 px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {inst?.course_name ?? '—'}
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    {inst?.instructor_name ?? 'ללא מדריך'} ·{' '}
                    {inst?.start_date
                      ? new Date(inst.start_date).toLocaleDateString('he-IL')
                      : '—'}
                    {' – '}
                    {inst?.end_date
                      ? new Date(inst.end_date).toLocaleDateString('he-IL')
                      : '—'}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnlinkClick(link.id)}
                  disabled={busy}
                  title="ניתוק"
                  className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && persistedId && (
        <div className="mt-2 border rounded-lg bg-white p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">בחר שיבוץ לקישור:</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPickerOpen(false)}
              className="h-6 text-[11px]"
            >
              סגור
            </Button>
          </div>
          {pickable.length === 0 ? (
            <p className="text-[11px] text-gray-500">
              אין שיבוצים זמינים. כל הכיתות של המוסד כבר מקושרות לקבוצה זו.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {pickable.map((inst) => (
                <button
                  type="button"
                  key={inst.id}
                  disabled={busy}
                  onClick={() => handleLinkClick(inst.id)}
                  className="w-full text-right text-xs border rounded px-2 py-1.5 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">{inst.course_name ?? '—'}</div>
                  <div className="text-gray-500 text-[11px]">
                    {inst.instructor_name ?? 'ללא מדריך'} ·{' '}
                    {inst.start_date
                      ? new Date(inst.start_date).toLocaleDateString('he-IL')
                      : '—'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Audit Tab ────────────────────────────────────────────────────────────────

interface AuditTabProps {
  loading: boolean;
  entries: AcademicYearOrderAudit[];
  userNames: Record<string, string>;
}

const formatAuditTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const summarizeAuditValue = (
  action: AcademicYearOrderAuditAction,
  oldVal: unknown,
  newVal: unknown
): string | null => {
  const pick = (v: unknown, key: string): string | null => {
    if (!v || typeof v !== 'object') return null;
    const rec = v as Record<string, unknown>;
    const val = rec[key];
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  switch (action) {
    case 'order_status_changed': {
      const from = pick(oldVal, 'status');
      const to = pick(newVal, 'status');
      if (!from && !to) return null;
      const fLabel = from ? ORDER_STATUS_LABELS[from as AcademicYearOrderStatus] ?? from : '—';
      const tLabel = to ? ORDER_STATUS_LABELS[to as AcademicYearOrderStatus] ?? to : '—';
      return `${fLabel} ← ${tLabel}`;
    }
    case 'order_dates_changed': {
      const fs = pick(oldVal, 'requested_start_date');
      const fe = pick(oldVal, 'requested_end_date');
      const ts = pick(newVal, 'requested_start_date');
      const te = pick(newVal, 'requested_end_date');
      return `${fs ?? '—'} – ${fe ?? '—'} ← ${ts ?? '—'} – ${te ?? '—'}`;
    }
    case 'order_location_changed': {
      const fc = pick(oldVal, 'city');
      const fr = pick(oldVal, 'region');
      const tc = pick(newVal, 'city');
      const tr = pick(newVal, 'region');
      return `${[fr, fc].filter(Boolean).join(', ') || '—'} ← ${[tr, tc].filter(Boolean).join(', ') || '—'}`;
    }
    case 'group_days_changed': {
      const days = pick(newVal, 'requested_days_of_week');
      return days ? `ימים: ${days}` : null;
    }
    case 'group_time_changed': {
      const tw = pick(newVal, 'requested_time_window');
      return tw ? `שעות: ${tw}` : null;
    }
    case 'group_count_changed': {
      const from = pick(oldVal, 'groups_count');
      const to = pick(newVal, 'groups_count');
      return `${from ?? '—'} ← ${to ?? '—'}`;
    }
    case 'group_scheduling_status_changed': {
      const from = pick(oldVal, 'scheduling_status');
      const to = pick(newVal, 'scheduling_status');
      return `${from ?? '—'} ← ${to ?? '—'}`;
    }
    default:
      return null;
  }
};

const AuditTab: React.FC<AuditTabProps> = ({ loading, entries, userNames }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
        טוען היסטוריה...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-500 border border-dashed rounded-lg bg-white">
        עדיין אין שינויים מתועדים בהזמנה זו.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const action = entry.action as AcademicYearOrderAuditAction;
        const label = ORDER_AUDIT_ACTION_LABELS[action] ?? action;
        const summary = summarizeAuditValue(action, entry.old_value, entry.new_value);
        const userName = entry.user_id ? userNames[entry.user_id] ?? 'משתמש' : 'מערכת';

        return (
          <div
            key={entry.id}
            className="border rounded-lg bg-white p-3 flex items-start gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[11px]">{label}</Badge>
                <span className="text-xs text-gray-500">
                  {formatAuditTimestamp(entry.created_at)}
                </span>
                <span className="text-xs text-gray-700 font-medium">{userName}</span>
              </div>
              {summary && (
                <p className="text-xs text-gray-600 mt-1 font-mono break-all">{summary}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Shared field wrapper ────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FieldRow: React.FC<FieldRowProps> = ({ label, hint, required, children }) => (
  <div className="space-y-1">
    <Label className="text-xs font-medium text-gray-700">
      {label}
      {required && <span className="text-red-600 ms-1">*</span>}
    </Label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

export default AcademicYearOrderEditorSheet;
