// supabase/functions/growth-copilot/rules.ts
// Canonical business rules for the Growth Copilot.
//
// Rules live HERE (not inside the prompt) so strategy is data, not text.
// At runtime we merge: DEFAULT_RULES  ⊕  ai_preferences.rules_json
//                      DEFAULT_PREFS  ⊕  ai_preferences.preferences_json
// The merged result is rendered into a Hebrew instruction block the prompt consumes.

export interface CopilotRules {
  one_mandatory_mission: boolean;        // exactly ONE strategic mission per day
  max_recommendations: number;           // hard cap on extra recommendations
  prefer_revenue: boolean;               // prefer revenue-generating actions
  prefer_existing_relationships: boolean; // prefer existing clients over cold outreach
  prefer_warm_leads: boolean;            // prefer warm leads over cold
  avoid_low_impact: boolean;             // avoid busy-work / low-leverage actions
  avoid_duplicate_missions: boolean;     // do not repeat a recent mission
  skip_if_previous_unfinished: boolean;  // if yesterday's mission isn't done, follow up instead of inventing a new one
  prefer_goal_advancing: boolean;        // prefer actions that close the biggest goal gap
  min_impact_score: number;              // discard mission ideas below this impact (1-10)
}

export interface CopilotPreferences {
  sales_first: boolean;
  one_strategic_action_per_day: boolean;
  prefer_existing_clients: boolean;
  prefer_warm_leads: boolean;
  explain_simply: boolean;
  avoid_busy_work: boolean;
  max_recommendations: number;
  [key: string]: unknown;
}

export const DEFAULT_RULES: CopilotRules = {
  one_mandatory_mission: true,
  max_recommendations: 2,
  prefer_revenue: true,
  prefer_existing_relationships: true,
  prefer_warm_leads: true,
  avoid_low_impact: true,
  avoid_duplicate_missions: true,
  skip_if_previous_unfinished: true,
  prefer_goal_advancing: true,
  min_impact_score: 5,
};

export const DEFAULT_PREFS: CopilotPreferences = {
  sales_first: true,
  one_strategic_action_per_day: true,
  prefer_existing_clients: true,
  prefer_warm_leads: true,
  explain_simply: true,
  avoid_busy_work: true,
  max_recommendations: 2,
};

export function mergeRules(override: Record<string, unknown> | null | undefined): CopilotRules {
  return { ...DEFAULT_RULES, ...(override ?? {}) } as CopilotRules;
}

export function mergePrefs(override: Record<string, unknown> | null | undefined): CopilotPreferences {
  return { ...DEFAULT_PREFS, ...(override ?? {}) } as CopilotPreferences;
}

// Render the active rules into a Hebrew instruction block for the prompt.
// (The model output is Hebrew; rules are described in Hebrew so the model reasons in-language.)
export function renderRulesHebrew(rules: CopilotRules, prefs: CopilotPreferences): string {
  const lines: string[] = [];
  if (rules.one_mandatory_mission) lines.push('• בחר משימה אחת בלבד — המשימה החשובה ביותר להיום.');
  lines.push(`• אל תציע יותר מ-${rules.max_recommendations} המלצות נוספות (קצרות).`);
  if (rules.prefer_goal_advancing) lines.push('• העדף פעולה שסוגרת את הפער הגדול ביותר ביעדים החודשיים.');
  if (rules.prefer_revenue) lines.push('• העדף פעולות שמייצרות הכנסה.');
  if (rules.prefer_existing_relationships) lines.push('• העדף לקוחות קיימים על פני פנייה קרה.');
  if (rules.prefer_warm_leads) lines.push('• העדף לידים חמים על פני קרים.');
  if (rules.avoid_low_impact) lines.push('• הימנע מפעולות בעלות ערך נמוך (busy work).');
  if (rules.avoid_duplicate_missions) lines.push('• אל תחזור על משימה שכבר ניתנה לאחרונה.');
  lines.push(`• אל תבחר משימה עם impact_score נמוך מ-${rules.min_impact_score}.`);
  if (prefs.explain_simply) lines.push('• הסבר בעברית פשוטה. הנח שלמשתמש ידע שיווקי וטכני מוגבל.');
  return lines.join('\n');
}
