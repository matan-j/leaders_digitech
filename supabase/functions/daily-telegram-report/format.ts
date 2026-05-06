// supabase/functions/daily-telegram-report/format.ts
// Pure formatting — produces a Telegram HTML-formatted Hebrew message.

import type { ProjectActivity, ProjectsReport } from './projects.ts';
import type { LeadsReport } from './leads.ts';
import { escapeHtml } from '../_shared/telegram.ts';

const TOP_N = 5;

function describeProjectActivity(a: ProjectActivity): string {
  const parts: string[] = [];
  if (a.tasks_created > 0) parts.push(`${a.tasks_created} משימות חדשות`);
  if (a.task_updates > 0) parts.push(`${a.task_updates} משימות התקדמו`);
  if (a.tasks_completed > 0) parts.push(`${a.tasks_completed} הושלמו`);
  if (a.tasks_blocked > 0) parts.push(`${a.tasks_blocked} חסומות`);
  if (a.comments_added > 0) parts.push(`${a.comments_added} עדכונים`);
  return parts.length ? parts.join(', ') : 'פעילות קלה';
}

function topAndOverflow<T>(arr: T[], n = TOP_N): { top: T[]; rest: number } {
  if (arr.length <= n) return { top: arr, rest: 0 };
  return { top: arr.slice(0, n), rest: arr.length - n };
}

function israelTimeLabel(d: Date): string {
  // "HH:MM" in Asia/Jerusalem
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function israelDateLabel(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export interface BuildArgs {
  projects: ProjectsReport;
  leads: LeadsReport;
  windowEnd: Date;
}

export function buildTelegramDailyReport({ projects, leads, windowEnd }: BuildArgs): string {
  const lines: string[] = [];

  // Header
  lines.push(`<b>📊 דוח ביצוע יומי — Leader</b>`);
  lines.push(`${israelDateLabel(windowEnd)} • ${israelTimeLabel(windowEnd)}`);

  // ─── Section 1: Projects ─────────────────────────────────
  lines.push('');
  lines.push('<b>פרויקטים</b>');

  if (projects.active.length === 0 && projects.inactive.length === 0) {
    lines.push('<i>אין פרויקטים פעילים</i>');
  } else if (projects.active.length === 0) {
    lines.push('<i>לא זוהתה התקדמות מאז הדוח הקודם</i>');
  } else {
    const { top, rest } = topAndOverflow(projects.active);
    for (const p of top) {
      lines.push(`• <b>${escapeHtml(p.project_name)}</b> — ${describeProjectActivity(p)}`);
    }
    if (rest > 0) lines.push(`<i>+ ${rest} נוספים</i>`);
  }

  // ─── Section 2: Open tasks ───────────────────────────────
  lines.push('');
  lines.push('<b>משימות פתוחות</b>');
  lines.push(`סה"כ: <b>${projects.totalOpen}</b>`);

  if (projects.openByAssignee.length > 0) {
    const { top, rest } = topAndOverflow(projects.openByAssignee);
    for (const a of top) {
      const name = escapeHtml(a.full_name ?? 'ללא שם');
      const extras: string[] = [];
      if (a.in_review > 0) extras.push(`${a.in_review} בבדיקה`);
      if (a.overdue > 0) extras.push(`${a.overdue} באיחור`);
      const suffix = extras.length ? `, ${extras.join(', ')}` : '';
      lines.push(`• ${name} — ${a.open_total} פתוחות${suffix}`);
    }
    if (rest > 0) lines.push(`<i>+ ${rest} נוספים</i>`);
  }

  // ─── Section 3: Leads ────────────────────────────────────
  lines.push('');
  lines.push('<b>לידים</b>');

  const totalLeads = Object.values(leads.riskSnapshot ?? leads.stageSnapshot).reduce((s, n) => s + n, 0);
  const noLeadActivity =
    leads.riskChangedInWindow === 0 &&
    leads.stageChangedInWindow === 0 &&
    leads.classChangedInWindow === 0 &&
    leads.contactedInWindow === 0 &&
    leads.activitiesCreated === 0;

  if (totalLeads === 0) {
    lines.push('<i>אין לידים פעילים</i>');
  } else if (noLeadActivity) {
    lines.push('<i>לא זוהתה התקדמות מאז הדוח הקודם</i>');
  } else {
    // ▸ שלב פייפליין
    lines.push('');
    lines.push('▸ <b>שלב פייפליין</b>');
    if (leads.hasStageAudit && leads.stageChangedInWindow > 0) {
      const sb = Object.entries(leads.stageMovementBreakdown)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [stage, count] of sb) {
        lines.push(`   • <b>${count}</b> לידים עברו ל-${escapeHtml(stage)}`);
      }
      lines.push(`   <i>סה"כ: ${leads.stageChangedInWindow} לידים</i>`);
    } else {
      lines.push('   <i>ללא תזוזה ב-24 השעות האחרונות</i>');
    }

    // ▸ סטטוס שיחה
    lines.push('');
    lines.push('▸ <b>סטטוס שיחה</b>');
    if (leads.hasRiskAudit && leads.riskChangedInWindow > 0) {
      const sb = Object.entries(leads.riskMovementBreakdown)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [status, count] of sb) {
        lines.push(`   • <b>${count}</b> לידים עברו ל-${escapeHtml(status)}`);
      }
      lines.push(`   <i>סה"כ: ${leads.riskChangedInWindow} לידים</i>`);
    } else {
      lines.push('   <i>ללא תזוזה ב-24 השעות האחרונות</i>');
    }

    // ▸ פעילות (פעילויות חדשות, יצירת קשר, סיווג)
    if (leads.contactedInWindow > 0 || leads.activitiesCreated > 0 || (leads.hasStageAudit && leads.classChangedInWindow > 0)) {
      lines.push('');
      lines.push('▸ <b>פעילות</b>');
      if (leads.contactedInWindow > 0) {
        lines.push(`   • <b>${leads.contactedInWindow}</b> לידים נוצר איתם קשר`);
      }
      if (leads.activitiesCreated > 0) {
        lines.push(`   • <b>${leads.activitiesCreated}</b> פעילויות / הערות חדשות`);
        const breakdown = Object.entries(leads.activityTypeBreakdown)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);
        if (breakdown.length > 0) {
          lines.push(
            `   <i>לפי סוג: ${breakdown.map(([k, n]) => `${escapeHtml(k)} ${n}`).join(', ')}</i>`
          );
        }
      }
      if (leads.hasStageAudit && leads.classChangedInWindow > 0) {
        lines.push(`   • <b>${leads.classChangedInWindow}</b> לידים שינו סיווג (Lead/Customer)`);
      }
    }
  }

  // ─── Section 4: Needs attention ──────────────────────────
  const noProgressProjects = projects.inactive.length;
  const totalOverdue = projects.overdueByProject.reduce((s, p) => s + p.count, 0);
  const totalBlocked = projects.blockedByProject.reduce((s, p) => s + p.count, 0);
  const stuckLeadsCount = leads.stuckLeads.length;

  if (noProgressProjects > 0 || totalOverdue > 0 || totalBlocked > 0 || stuckLeadsCount > 0) {
    lines.push('');
    lines.push('<b>⚠️ דורש תשומת לב</b>');

    if (noProgressProjects > 0) {
      const names = projects.inactive.slice(0, TOP_N).map(p => escapeHtml(p.name)).join(', ');
      const more = projects.inactive.length > TOP_N ? ` (+${projects.inactive.length - TOP_N} נוספים)` : '';
      lines.push(`• <b>${noProgressProjects}</b> פרויקטים ללא התקדמות: ${names}${more}`);
    }
    if (totalBlocked > 0) {
      const top = projects.blockedByProject.slice(0, 3).map(p => `${escapeHtml(p.project_name)} ${p.count}`).join(', ');
      lines.push(`• <b>${totalBlocked}</b> משימות חסומות (${top})`);
    }
    if (totalOverdue > 0) {
      const top = projects.overdueByProject.slice(0, 3).map(p => `${escapeHtml(p.project_name)} ${p.count}`).join(', ');
      lines.push(`• <b>${totalOverdue}</b> משימות באיחור (${top})`);
    }
    if (stuckLeadsCount > 0) {
      const sampleNames = leads.stuckLeads
        .slice(0, 3)
        .map(l => escapeHtml(l.name ?? 'ללא שם'))
        .join(', ');
      const more = stuckLeadsCount > 3 ? ` (+${stuckLeadsCount - 3})` : '';
      lines.push(`• <b>${stuckLeadsCount}</b> לידים ללא פעילות מעל ${leads.stuckThresholdDays} ימים: ${sampleNames}${more}`);
    }
  }

  // Schema warnings (if any) — only in debug; keeps message clean
  if (leads.schemaWarnings.length > 0) {
    lines.push('');
    lines.push(`<i>הערות סכמה: ${leads.schemaWarnings.length}</i>`);
  }

  return lines.join('\n');
}
