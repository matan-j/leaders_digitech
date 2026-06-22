// supabase/functions/growth-copilot/context.ts
// Gathers the strategic context the Copilot reasons over.
// Self-contained (no cross-function imports) so the function deploys independently.
// Every block is fault-isolated — a failing query degrades gracefully to empty.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js';

const STUCK_THRESHOLD_DAYS = 3;

export interface GoalWithGap {
  id: string;
  goal_type: string;
  period_type: string;
  target_value: number;
  current_value: number;
  gap: number;                 // target - current (heavily weights mission selection)
  priority: number;
  success_definition: string | null;
}

export interface GrowthContext {
  entity: string;
  goals: GoalWithGap[];
  opportunities: {
    open_count: number;
    total_value: number;
    top: { id: string; name: string | null; stage: string | null; value: number | null; probability: number | null }[];
  };
  leads: {
    total: number;
    stuck_count: number;
    by_stage: Record<string, number>;
    needs_followup: { id: string; name: string | null; stage: string | null; potential: number | null; last_contact_at: string | null }[];
  };
  organizations: { leads: number; customers: number };
  tasks: { open_count: number };
  products: { name: string; school_type: string | null }[];
  warnings: string[];
}

export async function gatherGrowthContext(
  supabase: SupabaseClient,
  entity: string,
): Promise<GrowthContext> {
  const warnings: string[] = [];

  // ── 1. Active CEO goals (+ gap) ─────────────────────────────
  let goals: GoalWithGap[] = [];
  try {
    const { data, error } = await supabase
      .from('ceo_goals')
      .select('id, goal_type, period_type, target_value, current_value, priority, success_definition')
      .eq('entity', entity)
      .eq('status', 'active');
    if (error) {
      warnings.push(`ceo_goals: ${error.message}`);
    } else {
      goals = (data ?? []).map((g: Record<string, unknown>) => {
        const target = Number(g.target_value ?? 0);
        const current = Number(g.current_value ?? 0);
        return {
          id: String(g.id),
          goal_type: String(g.goal_type ?? ''),
          period_type: String(g.period_type ?? ''),
          target_value: target,
          current_value: current,
          gap: target - current,
          priority: Number(g.priority ?? 1),
          success_definition: (g.success_definition as string) ?? null,
        };
      }).sort((a, b) => b.gap - a.gap); // biggest gap first
    }
  } catch (e) {
    warnings.push(`ceo_goals threw: ${String(e)}`);
  }

  // ── 2. Open opportunities ───────────────────────────────────
  const opportunities = { open_count: 0, total_value: 0, top: [] as GrowthContext['opportunities']['top'] };
  try {
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select('id, name, stage, status, value, probability')
      .eq('status', 'open')
      .order('value', { ascending: false })
      .limit(15);
    if (error) {
      warnings.push(`crm_opportunities: ${error.message}`);
    } else {
      const rows = data ?? [];
      opportunities.open_count = rows.length;
      opportunities.total_value = rows.reduce((s: number, o: Record<string, unknown>) => s + Number(o.value ?? 0), 0);
      opportunities.top = rows.slice(0, 8).map((o: Record<string, unknown>) => ({
        id: String(o.id),
        name: (o.name as string) ?? null,
        stage: (o.stage as string) ?? null,
        value: o.value != null ? Number(o.value) : null,
        probability: o.probability != null ? Number(o.probability) : null,
      }));
    }
  } catch (e) {
    warnings.push(`crm_opportunities threw: ${String(e)}`);
  }

  // ── 3. Leads (stuck / needs follow-up) + organizations split ─
  const leads = { total: 0, stuck_count: 0, by_stage: {} as Record<string, number>, needs_followup: [] as GrowthContext['leads']['needs_followup'] };
  const organizations = { leads: 0, customers: 0 };
  try {
    const { data, error } = await supabase
      .from('educational_institutions')
      .select('id, name, crm_class, crm_stage, crm_potential, crm_last_contact_at');
    if (error) {
      warnings.push(`educational_institutions: ${error.message}`);
    } else {
      const rows = (data ?? []) as Record<string, unknown>[];
      const now = Date.now();
      const cutoff = now - STUCK_THRESHOLD_DAYS * 86400000;
      const leadRows = rows.filter((r) => r.crm_class === 'Lead');
      organizations.leads = leadRows.length;
      organizations.customers = rows.filter((r) => r.crm_class === 'Customer').length;
      leads.total = leadRows.length;

      for (const r of leadRows) {
        const stage = (r.crm_stage as string) ?? 'ללא שלב';
        leads.by_stage[stage] = (leads.by_stage[stage] ?? 0) + 1;
      }

      const stuck = leadRows.filter((r) => {
        const lc = r.crm_last_contact_at ? new Date(r.crm_last_contact_at as string).getTime() : 0;
        return !r.crm_last_contact_at || lc < cutoff;
      });
      leads.stuck_count = stuck.length;
      leads.needs_followup = stuck
        .sort((a, b) => Number(b.crm_potential ?? 0) - Number(a.crm_potential ?? 0))
        .slice(0, 8)
        .map((r) => ({
          id: String(r.id),
          name: (r.name as string) ?? null,
          stage: (r.crm_stage as string) ?? null,
          potential: r.crm_potential != null ? Number(r.crm_potential) : null,
          last_contact_at: (r.crm_last_contact_at as string) ?? null,
        }));
    }
  } catch (e) {
    warnings.push(`educational_institutions threw: ${String(e)}`);
  }

  // ── 4. Open execution load ──────────────────────────────────
  const tasks = { open_count: 0 };
  try {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'done');
    if (error) warnings.push(`tasks: ${error.message}`);
    else tasks.open_count = count ?? 0;
  } catch (e) {
    warnings.push(`tasks threw: ${String(e)}`);
  }

  // ── 5. Products (for expansion suggestions) ─────────────────
  let products: GrowthContext['products'] = [];
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('name, school_type')
      .eq('is_visible', true)
      .limit(25);
    if (error) warnings.push(`courses: ${error.message}`);
    else products = (data ?? []).map((c: Record<string, unknown>) => ({
      name: String(c.name ?? ''),
      school_type: (c.school_type as string) ?? null,
    }));
  } catch (e) {
    warnings.push(`courses threw: ${String(e)}`);
  }

  return { entity, goals, opportunities, leads, organizations, tasks, products, warnings };
}
