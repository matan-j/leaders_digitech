// Thin data-access layer for the Academic Year Orders module.
// All writes that touch order + groups together MUST go through saveAcademicYearOrder
// (the RPC enforces atomicity). Simple status flips can use direct table updates.

import { supabase } from '@/integrations/supabase/client';
import type {
  AcademicYearOrder,
  AcademicYearOrderAudit,
  AcademicYearOrderGroup,
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
