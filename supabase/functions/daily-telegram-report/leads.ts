// supabase/functions/daily-telegram-report/leads.ts
// Builds the CRM/Leads portion of the daily report.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js';

export interface LeadsReport {
  windowStart: string;
  windowEnd: string;
  // PRIMARY signal — leads whose "סטטוס" (crm_risk) changed in the window.
  // This is the column the user sees as "סטטוס" in the CRM:
  //   high   = לא שוחחנו
  //   medium = בתהליך
  //   low    = שוחחנו
  riskChangedInWindow: number;
  // breakdown by destination risk label (Hebrew)
  riskMovementBreakdown: Record<string, number>;
  // current snapshot of risk distribution
  riskSnapshot: Record<string, number>;
  hasRiskAudit: boolean;
  // SECONDARY: stage (שלב פייפליין)
  stageChangedInWindow: number;
  classChangedInWindow: number;
  hasStageAudit: boolean;
  // primary indicator: institutions where crm_last_contact_at landed in the window
  contactedInWindow: number;
  // proxy for "moved status" (legacy): activities with non-null outcome in window
  withOutcome: number;
  // notes/activity received
  activitiesCreated: number;
  // breakdown of activity TYPES created in window (e.g., שיחה=3, מייל=4)
  activityTypeBreakdown: Record<string, number>;
  // current snapshot of crm_stage among Lead institutions
  stageSnapshot: Record<string, number>;
  // breakdown of which stages received movement in the window
  stageMovementBreakdown: Record<string, number>;
  // Stuck leads: crm_class='Lead' with no contact for >3 days (or NULL)
  stuckLeads: { id: string; name: string | null; lastContactAt: string | null }[];
  stuckThresholdDays: number;
  // Whether full schema was available (false → some fallbacks were used)
  schemaWarnings: string[];
}

// Display labels for crm_risk values
const RISK_LABEL: Record<string, string> = {
  high: 'לא שוחחנו',
  medium: 'בתהליך',
  low: 'שוחחנו',
};
const riskDisplay = (v: string | null | undefined): string => {
  if (!v) return 'ללא';
  return RISK_LABEL[v] ?? v;
};

const STUCK_THRESHOLD_DAYS = 3;

interface InstitutionRow {
  id: string;
  name: string | null;
  crm_class: string | null;
  crm_stage: string | null;
  crm_risk: string | null;
  crm_last_contact_at: string | null;
  crm_stage_updated_at?: string | null;
  crm_class_updated_at?: string | null;
  crm_risk_updated_at?: string | null;
}

interface ActivityRow {
  id: string;
  institution_id: string;
  type: string | null;
  outcome: string | null;
  created_at: string;
}

export async function getLeadsProgressReport(
  supabase: SupabaseClient,
  windowStart: Date,
  windowEnd: Date
): Promise<LeadsReport> {
  const startIso = windowStart.toISOString();
  const endIso = windowEnd.toISOString();
  const warnings: string[] = [];

  // Pull leads + activities in parallel. Defensive selects.
  let institutions: InstitutionRow[] = [];
  let activities: ActivityRow[] = [];
  let hasStageAudit = false;

  // First try: select WITH the audit columns (added by 20260504* migrations).
  // If the columns don't exist (older schema), fall back to the legacy select.
  let hasRiskAudit = false;
  try {
    const { data, error } = await supabase
      .from('educational_institutions')
      .select('id, name, crm_class, crm_stage, crm_risk, crm_last_contact_at, crm_stage_updated_at, crm_class_updated_at, crm_risk_updated_at')
      .eq('crm_class', 'Lead');
    if (error) {
      // Likely "column does not exist" on older schemas → fall back.
      warnings.push(`institutions audit-aware select failed (using fallback): ${error.message}`);
      const fb = await supabase
        .from('educational_institutions')
        .select('id, name, crm_class, crm_stage, crm_risk, crm_last_contact_at')
        .eq('crm_class', 'Lead');
      if (fb.error) {
        warnings.push(`institutions fallback select failed: ${fb.error.message}`);
      } else {
        institutions = (fb.data ?? []) as InstitutionRow[];
      }
    } else {
      institutions = (data ?? []) as InstitutionRow[];
      hasStageAudit = true;
      hasRiskAudit = true;
    }
  } catch (e) {
    warnings.push(`institutions select threw: ${String(e)}`);
  }

  try {
    const { data, error } = await supabase
      .from('crm_activities')
      .select('id, institution_id, type, outcome, created_at')
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    if (error) {
      warnings.push(`activities select failed: ${error.message}`);
    } else {
      activities = (data ?? []) as ActivityRow[];
    }
  } catch (e) {
    warnings.push(`activities select threw: ${String(e)}`);
  }

  // contactedInWindow: institutions with crm_last_contact_at in [start, end]
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  const contactedInWindow = institutions.filter(i => {
    if (!i.crm_last_contact_at) return false;
    const t = new Date(i.crm_last_contact_at).getTime();
    return t >= startMs && t <= endMs;
  }).length;

  // REAL stage / class / risk movement (only when audit columns exist)
  let stageChangedInWindow = 0;
  let classChangedInWindow = 0;
  let riskChangedInWindow = 0;
  const stageMovementBreakdown: Record<string, number> = {};
  const riskMovementBreakdown: Record<string, number> = {};
  if (hasStageAudit) {
    for (const i of institutions) {
      if (i.crm_stage_updated_at) {
        const t = new Date(i.crm_stage_updated_at).getTime();
        if (t >= startMs && t <= endMs) {
          stageChangedInWindow++;
          const k = i.crm_stage ?? 'ללא שלב';
          stageMovementBreakdown[k] = (stageMovementBreakdown[k] ?? 0) + 1;
        }
      }
      if (i.crm_class_updated_at) {
        const t = new Date(i.crm_class_updated_at).getTime();
        if (t >= startMs && t <= endMs) classChangedInWindow++;
      }
      if (i.crm_risk_updated_at) {
        const t = new Date(i.crm_risk_updated_at).getTime();
        if (t >= startMs && t <= endMs) {
          riskChangedInWindow++;
          const label = riskDisplay(i.crm_risk);
          riskMovementBreakdown[label] = (riskMovementBreakdown[label] ?? 0) + 1;
        }
      }
    }
  }

  // Risk snapshot — current distribution of "סטטוס" across leads
  const riskSnapshot: Record<string, number> = {};
  for (const i of institutions) {
    const k = riskDisplay(i.crm_risk);
    riskSnapshot[k] = (riskSnapshot[k] ?? 0) + 1;
  }

  const withOutcome = activities.filter(a => !!a.outcome && a.outcome.trim().length > 0).length;
  const activitiesCreated = activities.length;

  const activityTypeBreakdown: Record<string, number> = {};
  for (const a of activities) {
    const k = a.type ?? 'אחר';
    activityTypeBreakdown[k] = (activityTypeBreakdown[k] ?? 0) + 1;
  }

  const stageSnapshot: Record<string, number> = {};
  for (const i of institutions) {
    const k = i.crm_stage ?? 'ללא שלב';
    stageSnapshot[k] = (stageSnapshot[k] ?? 0) + 1;
  }

  // Stuck: Lead with no last_contact OR last_contact older than threshold
  const cutoff = new Date(windowEnd);
  cutoff.setDate(cutoff.getDate() - STUCK_THRESHOLD_DAYS);
  const cutoffMs = cutoff.getTime();
  const stuckLeads = institutions
    .filter(i => {
      if (!i.crm_last_contact_at) return true;
      return new Date(i.crm_last_contact_at).getTime() < cutoffMs;
    })
    .map(i => ({ id: i.id, name: i.name, lastContactAt: i.crm_last_contact_at }))
    .sort((a, b) => {
      const ta = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
      const tb = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
      return ta - tb;
    });

  return {
    windowStart: startIso,
    windowEnd: endIso,
    riskChangedInWindow,
    riskMovementBreakdown,
    riskSnapshot,
    hasRiskAudit,
    stageChangedInWindow,
    classChangedInWindow,
    hasStageAudit,
    contactedInWindow,
    withOutcome,
    activitiesCreated,
    activityTypeBreakdown,
    stageSnapshot,
    stageMovementBreakdown,
    stuckLeads,
    stuckThresholdDays: STUCK_THRESHOLD_DAYS,
    schemaWarnings: warnings,
  };
}
