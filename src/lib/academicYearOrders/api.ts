// Thin data-access layer for the Academic Year Orders module.
// All writes that touch order + groups together MUST go through saveAcademicYearOrder
// (the RPC enforces atomicity). Simple status flips can use direct table updates.

import { supabase } from '@/integrations/supabase/client';
import type {
  AcademicYearOrder,
  AcademicYearOrderAudit,
  AcademicYearOrderGroup,
  AcademicYearOrderGroupInstance,
  AcademicYearOrderPayload,
  AcademicYearOrderWithGroups,
  SaveAcademicYearOrderResult,
} from '@/types/academicYearOrders';

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listOrdersByInstitution(institutionId: string): Promise<AcademicYearOrder[]> {
  const { data, error } = await supabase
    .from('academic_year_orders')
    .select('*')
    .eq('institution_id', institutionId)
    .order('academic_year', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademicYearOrder[];
}

export async function getOrderWithGroups(orderId: string): Promise<AcademicYearOrderWithGroups | null> {
  const { data: order, error: orderErr } = await supabase
    .from('academic_year_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) return null;

  const { data: groups, error: groupsErr } = await supabase
    .from('academic_year_order_groups')
    .select('*')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });
  if (groupsErr) throw groupsErr;

  return {
    order: order as AcademicYearOrder,
    groups: (groups ?? []) as AcademicYearOrderGroup[],
  };
}

export async function listAuditByOrder(orderId: string): Promise<AcademicYearOrderAudit[]> {
  const { data, error } = await supabase
    .from('academic_year_order_audit')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademicYearOrderAudit[];
}

// ─── Atomic save (RPC) ───────────────────────────────────────────────────────

export async function saveAcademicYearOrder(
  payload: AcademicYearOrderPayload
): Promise<SaveAcademicYearOrderResult> {
  // Cast: supabase-js types the RPC arg as Json; our payload is a strict subset.
  const { data, error } = await supabase.rpc('save_academic_year_order', {
    payload: payload as unknown as never,
  });
  if (error) throw error;
  return data as unknown as SaveAcademicYearOrderResult;
}

// ─── Delete (RLS enforces admin/PM-only) ─────────────────────────────────────

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from('academic_year_orders').delete().eq('id', orderId);
  if (error) throw error;
}

// ─── Phase 8: group ↔ course_instance scheduling links ───────────────────────

export async function listGroupInstances(
  groupIds: string[]
): Promise<AcademicYearOrderGroupInstance[]> {
  if (groupIds.length === 0) return [];
  // The link table exists in the DB but isn't in the generated Supabase types yet.
  // Cast through `as any` is intentional and isolated to this module.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('academic_year_order_group_instances')
    .select('*')
    .in('group_id', groupIds);
  if (error) throw error;
  return (data ?? []) as AcademicYearOrderGroupInstance[];
}

export async function linkGroupInstance(
  groupId: string,
  courseInstanceId: string,
  notes?: string | null
): Promise<AcademicYearOrderGroupInstance> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('academic_year_order_group_instances')
    .insert({ group_id: groupId, course_instance_id: courseInstanceId, notes: notes ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as AcademicYearOrderGroupInstance;
}

export async function unlinkGroupInstance(linkId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('academic_year_order_group_instances')
    .delete()
    .eq('id', linkId);
  if (error) throw error;
}

// Lightweight course_instance shape used by the scheduling picker.
// Joined with course name + instructor name for display.
export interface CourseInstanceSummary {
  id: string;
  course_id: string | null;
  course_name: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
}

export async function listInstitutionCourseInstances(
  institutionId: string
): Promise<CourseInstanceSummary[]> {
  const { data, error } = await supabase
    .from('course_instances')
    .select(`
      id,
      course_id,
      instructor_id,
      start_date,
      end_date,
      days_of_week,
      course:courses(name),
      instructor:profiles(full_name)
    `)
    .eq('institution_id', institutionId)
    .order('start_date', { ascending: false });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    course_name: r.course?.name ?? null,
    instructor_id: r.instructor_id,
    instructor_name: r.instructor?.full_name ?? null,
    start_date: r.start_date,
    end_date: r.end_date,
    days_of_week: r.days_of_week,
  }));
}
