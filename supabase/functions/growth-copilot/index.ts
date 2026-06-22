// supabase/functions/growth-copilot/index.ts
// Growth Copilot — daily strategic mission generator (service-role).
//
// MVP action: generate_mission
//   1. gather strategic context (ceo_goals + CRM)
//   2. merge rules.ts defaults ⊕ ai_preferences
//   3. Claude → ONE mission (6-part Hebrew) + impact_score
//   4. upsert growth_mission_runs (run_date unique) with structured input_* snapshots
//   5. create a normal tasks row (the execution unit) → store task_id
//   6. optionally push the mission to Telegram (CEO chat)
//
// Auth: verify_jwt = false (see config.toml). Writes use SERVICE_ROLE_KEY.
// Cron scheduling is intentionally NOT wired here yet (added after manual verification).

import { createClient } from 'jsr:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTelegramMessage, escapeHtml } from '../_shared/telegram.ts';
import { gatherGrowthContext } from './context.ts';
import { mergeRules, mergePrefs, renderRulesHebrew } from './rules.ts';
import { buildMissionPrompt, type PreviousMission } from './prompt.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// YYYY-MM-DD for "today" in Israel time (matches the daily-report convention).
function israelDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

interface MissionJson {
  mission_title: string;
  why_it_matters?: string;
  what_to_do?: string;
  how_to_do_it?: string;
  ready_message?: string;
  system_update?: string;
  success_criteria?: string;
  impact_score?: number;
  goal_type?: string | null;
}

function parseMissionJson(raw: string): MissionJson {
  // Strip accidental code fences / surrounding prose.
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s) as MissionJson;
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      // Sonnet 4.6 — best balance of intelligence, speed and cost for daily
      // strategic missions, Hebrew explanations and CRM-context reasoning.
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json() as { content?: { text: string }[]; error?: { message: string } };
  if (data.error) throw new Error(`Anthropic: ${data.error.message}`);
  return data.content?.[0]?.text ?? '';
}

function buildTelegramMessage(m: MissionJson, entity: string): string {
  const impact = m.impact_score != null ? ` · אימפקט ${m.impact_score}/10` : '';
  const lines = [
    `<b>🚀 משימת הצמיחה של היום</b> (${escapeHtml(entity)}${impact})`,
    `<b>${escapeHtml(m.mission_title)}</b>`,
    '',
    `<b>למה זה חשוב:</b> ${escapeHtml(m.why_it_matters)}`,
    `<b>מה עושים עכשיו:</b> ${escapeHtml(m.what_to_do)}`,
    `<b>איך:</b> ${escapeHtml(m.how_to_do_it)}`,
  ];
  if (m.ready_message) {
    lines.push('', '<b>הודעה מוכנה:</b>', `<code>${escapeHtml(m.ready_message)}</code>`);
  }
  if (m.success_criteria) lines.push('', `<b>מה נחשב הצלחה:</b> ${escapeHtml(m.success_criteria)}`);
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};
    const action: string = body.action ?? 'generate_mission';
    const entity: string = body.entity ?? 'Digitech';
    const force: boolean = body.force === true;
    const sendTelegram: boolean = body.send_telegram !== false; // default true
    const dryRun: boolean = body.dry_run === true;

    if (action !== 'generate_mission') {
      return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = israelDate(new Date());
    void force; // multiple missions/day are allowed — always create a new one

    // ── Previous mission (for "skip if unfinished" rule) ───────
    let previous: PreviousMission | null = null;
    try {
      const { data: prev } = await supabase
        .from('growth_mission_runs')
        .select('mission_title, status, run_date')
        .lt('run_date', today)
        .order('run_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) previous = { mission_title: prev.mission_title, status: prev.status };
    } catch { /* non-fatal */ }

    // ── Context + rules ───────────────────────────────────────
    const context = await gatherGrowthContext(supabase, entity);

    const { data: prefRow } = await supabase
      .from('ai_preferences')
      .select('rules_json, preferences_json')
      .eq('entity', entity)
      .maybeSingle();
    const rules = mergeRules(prefRow?.rules_json);
    const prefs = mergePrefs(prefRow?.preferences_json);
    const rulesHebrew = renderRulesHebrew(rules, prefs);

    // ── Generate ──────────────────────────────────────────────
    const prompt = buildMissionPrompt({ entity, context, rulesHebrew, previous });
    const raw = await callClaude(prompt);

    let mission: MissionJson;
    try {
      mission = parseMissionJson(raw);
    } catch (e) {
      console.error('[growth-copilot] mission JSON parse failed', e, raw.slice(0, 500));
      return jsonResponse({ ok: false, error: 'mission_parse_failed', raw }, 502);
    }
    if (!mission.mission_title) {
      return jsonResponse({ ok: false, error: 'mission_missing_title', raw }, 502);
    }

    if (dryRun) {
      return jsonResponse({ ok: true, dry_run: true, mission, context });
    }

    // Match the goal the mission advances (best-effort, by goal_type).
    const matchedGoal = mission.goal_type
      ? context.goals.find((g) => g.goal_type === mission.goal_type)
      : context.goals[0];

    // ── Create the execution task (reuse existing tasks engine) ─
    const taskDescription = [
      mission.why_it_matters && `למה זה חשוב: ${mission.why_it_matters}`,
      mission.what_to_do && `מה עושים: ${mission.what_to_do}`,
      mission.how_to_do_it && `איך: ${mission.how_to_do_it}`,
      mission.ready_message && `הודעה מוכנה: ${mission.ready_message}`,
      mission.system_update && `לעדכן במערכת: ${mission.system_update}`,
      mission.success_criteria && `הצלחה: ${mission.success_criteria}`,
    ].filter(Boolean).join('\n');

    let taskId: string | null = null;
    try {
      const { data: task, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          title: `🚀 ${mission.mission_title}`,
          description: taskDescription,
          status: 'todo',
          due_date: today,
        })
        .select('id')
        .single();
      if (taskErr) console.error('[growth-copilot] task insert failed', taskErr);
      else taskId = task?.id ?? null;
    } catch (e) {
      console.error('[growth-copilot] task insert threw', e);
    }

    // ── Upsert the mission run (run_date unique) ───────────────
    const missionRow = {
      run_date: today,
      entity,
      goal_id: matchedGoal?.id ?? null,
      task_id: taskId,
      mission_title: mission.mission_title,
      why_it_matters: mission.why_it_matters ?? null,
      what_to_do: mission.what_to_do ?? null,
      how_to_do_it: mission.how_to_do_it ?? null,
      ready_message: mission.ready_message ?? null,
      system_update: mission.system_update ?? null,
      success_criteria: mission.success_criteria ?? null,
      impact_score: typeof mission.impact_score === 'number'
        ? Math.max(1, Math.min(10, Math.round(mission.impact_score)))
        : null,
      input_goals: context.goals,
      input_leads: context.leads,
      input_opportunities: context.opportunities,
      input_tasks: context.tasks,
      input_organizations: context.organizations,
      status: 'generated',
    };

    const { data: saved, error: saveErr } = await supabase
      .from('growth_mission_runs')
      .insert(missionRow)
      .select('*')
      .single();
    if (saveErr) {
      console.error('[growth-copilot] mission upsert failed', saveErr);
      return jsonResponse({ ok: false, error: saveErr.message }, 500);
    }

    // ── Telegram push ─────────────────────────────────────────
    let telegram = null;
    if (sendTelegram) {
      telegram = await sendTelegramMessage(buildTelegramMessage(mission, entity), { parseMode: 'HTML' });
      console.log('[growth-copilot] telegram', telegram);
    }

    return jsonResponse({
      ok: true,
      mission: saved,
      task_id: taskId,
      telegram,
      context_warnings: context.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[growth-copilot] fatal', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
