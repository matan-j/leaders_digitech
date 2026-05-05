// supabase/functions/daily-telegram-report/index.ts
// Daily 15:00 Israel-time execution report → Telegram → CEO.
//
// Schedule (pg_cron, see migrations/20260501000000_schedule_daily_telegram_report.sql):
//   '0 12 * * *'  + '0 13 * * *'  UTC  → 15:00 Asia/Jerusalem year-round (DST-safe).
//
// The function double-checks the local Israel hour and aborts unless it's 15:00,
// unless body.manual === true (used by the admin "Send now" button in dev/admin UI).

import { createClient } from 'jsr:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { getProjectsProgressReport } from './projects.ts';
import { getLeadsProgressReport } from './leads.ts';
import { buildTelegramDailyReport } from './format.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function israelHour(d: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(fmt.format(d), 10);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Body may contain { manual: true, dry_run: true }.
  let body: { manual?: boolean; dry_run?: boolean } = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = {}; }
  }

  // ─── Auth: require either a valid Supabase JWT (caller is authenticated)
  //          OR a matching x-cron-secret header.
  // Supabase already enforces JWT auth on edge functions by default unless
  // you set verify_jwt=false. We additionally honor the cron-secret header so
  // pg_cron + service_role can call without a user JWT.
  const cronSecretHeader = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('authorization');
  const callerHasJwt = !!authHeader && authHeader.toLowerCase().startsWith('bearer ');
  const cronOk = CRON_SECRET && cronSecretHeader === CRON_SECRET;

  if (!callerHasJwt && !cronOk) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  // ─── Time guard: only run at 15:00 Israel time, unless manual.
  const now = new Date();
  if (!body.manual) {
    const hour = israelHour(now);
    if (hour !== 15) {
      console.log('[daily-telegram-report] skipped — Israel hour is', hour);
      return jsonResponse({ ok: true, skipped: true, israel_hour: hour });
    }
  }

  // ─── Window: now - 24h → now
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('[daily-telegram-report] window', {
    start: windowStart.toISOString(),
    end: windowEnd.toISOString(),
    manual: body.manual === true,
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ─── Gather data (each block is fault-isolated)
  let projectsReport;
  try {
    projectsReport = await getProjectsProgressReport(supabase, windowStart, windowEnd);
    console.log('[daily-telegram-report] projects', {
      active: projectsReport.active.length,
      inactive: projectsReport.inactive.length,
      open: projectsReport.totalOpen,
    });
  } catch (e) {
    console.error('[daily-telegram-report] projects fetch failed', e);
    projectsReport = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      active: [],
      inactive: [],
      openByAssignee: [],
      totalOpen: 0,
      blockedByProject: [],
      overdueByProject: [],
    };
  }

  let leadsReport;
  try {
    leadsReport = await getLeadsProgressReport(supabase, windowStart, windowEnd);
    console.log('[daily-telegram-report] leads', {
      contacted: leadsReport.contactedInWindow,
      activities: leadsReport.activitiesCreated,
      stuck: leadsReport.stuckLeads.length,
      warnings: leadsReport.schemaWarnings.length,
    });
  } catch (e) {
    console.error('[daily-telegram-report] leads fetch failed', e);
    leadsReport = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      contactedInWindow: 0,
      withOutcome: 0,
      activitiesCreated: 0,
      activityTypeBreakdown: {},
      stageSnapshot: {},
      stuckLeads: [],
      stuckThresholdDays: 3,
      schemaWarnings: [`leads fetch threw: ${String(e)}`],
    };
  }

  const message = buildTelegramDailyReport({
    projects: projectsReport,
    leads: leadsReport,
    windowEnd,
  });

  if (body.dry_run) {
    return jsonResponse({ ok: true, dry_run: true, message, projects: projectsReport, leads: leadsReport });
  }

  const send = await sendTelegramMessage(message, { parseMode: 'HTML' });
  console.log('[daily-telegram-report] telegram', send);

  return jsonResponse({
    ok: true,
    sent: send.ok,
    telegram: send,
    counts: {
      projects_active: projectsReport.active.length,
      projects_inactive: projectsReport.inactive.length,
      open_tasks: projectsReport.totalOpen,
      lead_activities: leadsReport.activitiesCreated,
      leads_contacted: leadsReport.contactedInWindow,
      stuck_leads: leadsReport.stuckLeads.length,
    },
  });
});
