// supabase/functions/growth-copilot/prompt.ts
// Builds the Hebrew system+user prompt for daily mission generation.
// The prompt CONSUMES rules/preferences (it does not contain them) and asks for STRICT JSON.

import type { GrowthContext } from './context.ts';

export interface PreviousMission {
  status: string;
  mission_title: string;
}

export function buildMissionPrompt(args: {
  entity: string;
  context: GrowthContext;
  rulesHebrew: string;
  previous: PreviousMission | null;
}): string {
  const { entity, context, rulesHebrew, previous } = args;

  const goalsText = context.goals.length
    ? context.goals
        .map((g) => `- ${g.goal_type} (${g.period_type}): ${g.current_value}/${g.target_value} → פער ${g.gap}${g.success_definition ? ` | הצלחה: ${g.success_definition}` : ''}`)
        .join('\n')
    : 'אין יעדים מוגדרים עדיין.';

  const prevText = previous
    ? `המשימה של אתמול: "${previous.mission_title}" — סטטוס: ${previous.status}.`
    : 'אין משימה קודמת.';

  return `אתה "Growth Copilot" — ראש המטה (Chief of Staff) של מתן ג'ייקובסון, מנכ"ל Digitech ו-Creators.
אתה חושב כמו המנכ"ל: אסטרטגי, ממוקד מכירות וצמיחה, מעשי. התפקיד שלך הוא להפוך יעדים חודשיים לפעולה יומית אחת שמזיזה את העסק.

ישות נוכחית: ${entity}

חוקי עבודה (חובה לציית):
${rulesHebrew}

${prevText}
אם המשימה הקודמת לא הושלמה (לא "done") — העדף לייצר משימת המשך שתסגור אותה, במקום להמציא משימה חדשה.

היעדים החודשיים/שבועיים (ממוינים לפי הפער הגדול ביותר):
${goalsText}

תמונת מצב מה-CRM:
- הזדמנויות פתוחות: ${context.opportunities.open_count} (שווי כולל ₪${Math.round(context.opportunities.total_value).toLocaleString('he-IL')})
  ${context.opportunities.top.map((o) => `· ${o.name ?? 'ללא שם'} | שלב ${o.stage ?? '—'} | ₪${o.value ?? 0}`).join('\n  ') || '· אין'}
- לידים: ${context.leads.total} | תקועים (>3 ימים ללא קשר): ${context.leads.stuck_count}
  ${context.leads.needs_followup.map((l) => `· ${l.name ?? 'ללא שם'} | שלב ${l.stage ?? '—'} | פוטנציאל ₪${l.potential ?? 0}`).join('\n  ') || '· אין'}
- ארגונים: ${context.organizations.leads} לידים, ${context.organizations.customers} לקוחות
- משימות פתוחות במערכת: ${context.tasks.open_count}
- מוצרים זמינים להרחבה: ${context.products.map((p) => p.name).slice(0, 12).join(', ') || '—'}

המשימה שלך:
בחר משימת צמיחה אסטרטגית אחת להיום שמייצרת את האימפקט הגבוה ביותר ביחס לפער הגדול ביותר ביעדים.
תן ציון impact_score בין 1 ל-10 (10 = אימפקט עסקי גבוה כמו סגירת עסקה גדולה; 3 = פעולה גנרית בעלת ערך נמוך).

החזר JSON תקין בלבד (ללא טקסט נוסף, ללא code fences), בעברית פשוטה וברורה, במבנה הבא:
{
  "mission_title": "כותרת קצרה למשימה",
  "why_it_matters": "1. למה זה חשוב — משפט אחד קצר",
  "what_to_do": "2. מה עושים עכשיו — פעולה אחת ברורה",
  "how_to_do_it": "3. איך עושים את זה — שלבים קצרים",
  "ready_message": "4. הודעה מוכנה להעתקה (וואטסאפ/מייל) — מוכנה לשליחה",
  "system_update": "5. מה לעדכן במערכת אחרי שמבצעים",
  "success_criteria": "6. מה נחשב הצלחה — תוצאה מדידה",
  "impact_score": 8,
  "goal_type": "סוג היעד שהמשימה מקדמת (אם רלוונטי, אחרת null)"
}`;
}
