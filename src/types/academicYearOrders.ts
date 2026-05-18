// TypeScript types for the Academic Year Orders module.
// The DB schema is the source of truth — these aliases live on top of the
// generated supabase types (src/integrations/supabase/types.ts).

import type { Database } from '@/integrations/supabase/types';

// ─── Status enums (kept in sync with CHECK constraints in migration 01/02) ───

export type AcademicYearOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduling'
  | 'scheduled'
  | 'cancelled'
  | 'archived';

export type AcademicYearOrderSchedulingStatus = 'not_started' | 'partial' | 'complete';

export type AcademicYearOrderGroupSchedulingStatus = 'pending' | 'scheduled' | 'cancelled';

export type AcademicYearOrderAuditAction =
  | 'order_created'
  | 'order_status_changed'
  | 'order_dates_changed'
  | 'order_instructor_changed'
  | 'order_location_changed'
  | 'group_added'
  | 'group_removed'
  | 'group_days_changed'
  | 'group_time_changed'
  | 'group_count_changed'
  | 'group_scheduling_status_changed';

// ─── Row types (read from DB) ────────────────────────────────────────────────

export type AcademicYearOrder = Database['public']['Tables']['academic_year_orders']['Row'];
export type AcademicYearOrderGroup = Database['public']['Tables']['academic_year_order_groups']['Row'];
export type AcademicYearOrderAudit = Database['public']['Tables']['academic_year_order_audit']['Row'];

// ─── Time window JSONB shape (enforced by chk_ayog_time_window_shape) ────────

export interface TimeWindow {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}

// ─── Display labels ──────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<AcademicYearOrderStatus, string> = {
  draft: 'טיוטה',
  pending_approval: 'ממתין לאישור',
  approved: 'אושר',
  scheduling: 'בשיבוץ',
  scheduled: 'שובץ',
  cancelled: 'בוטל',
  archived: 'בארכיון',
};

export const ORDER_SCHEDULING_STATUS_LABELS: Record<AcademicYearOrderSchedulingStatus, string> = {
  not_started: 'טרם החל',
  partial: 'חלקי',
  complete: 'הושלם',
};

export const GROUP_SCHEDULING_STATUS_LABELS: Record<AcademicYearOrderGroupSchedulingStatus, string> = {
  pending: 'ממתין',
  scheduled: 'שובץ',
  cancelled: 'בוטל',
};

export const ORDER_AUDIT_ACTION_LABELS: Record<AcademicYearOrderAuditAction, string> = {
  order_created: 'נוצרה הזמנה',
  order_status_changed: 'שינוי סטטוס',
  order_dates_changed: 'שינוי תאריכים',
  order_instructor_changed: 'שינוי מדריך מועדף',
  order_location_changed: 'שינוי מיקום',
  group_added: 'נוספה קבוצה',
  group_removed: 'הוסרה קבוצה',
  group_days_changed: 'שינוי ימים',
  group_time_changed: 'שינוי שעות',
  group_count_changed: 'שינוי כמות קבוצות',
  group_scheduling_status_changed: 'שינוי סטטוס שיבוץ',
};

// ─── RPC payload shapes (passed to save_academic_year_order) ─────────────────

export interface AcademicYearOrderGroupPayload {
  id?: string | null;                  // present for existing groups; absent for new
  course_id?: string | null;
  age_group?: string | null;
  grade_label?: string | null;
  groups_count?: number;
  requested_days_of_week?: number[] | null;
  requested_time_window?: TimeWindow | null;
  meetings_count?: number | null;
  hours_per_meeting?: number | null;
  scheduling_status?: AcademicYearOrderGroupSchedulingStatus;
  sort_order?: number;
  notes?: string | null;
}

export interface AcademicYearOrderPayload {
  id?: string | null;                  // present for updates; absent for new
  institution_id: string;
  academic_year: string;
  status?: AcademicYearOrderStatus;
  source_quote_id?: string | null;
  source_opportunity_id?: string | null;
  groups_count_planned?: number | null;
  total_meetings_planned?: number | null;
  hours_per_meeting?: number | null;
  city?: string | null;
  region?: string | null;
  preferred_instructor_id?: string | null;
  requested_start_date?: string | null; // YYYY-MM-DD
  requested_end_date?: string | null;
  scheduling_status?: AcademicYearOrderSchedulingStatus;
  notes?: string | null;
  groups: AcademicYearOrderGroupPayload[];
}

export interface SaveAcademicYearOrderResult {
  order_id: string;
  is_new: boolean;
}

// ─── Composite shape for editor screens ──────────────────────────────────────

export interface AcademicYearOrderWithGroups {
  order: AcademicYearOrder;
  groups: AcademicYearOrderGroup[];
}
