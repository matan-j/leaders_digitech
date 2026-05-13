export interface DescriptionInput {
  grade_label?: string | null;
  class_label?: string | null;
  meetings_count?: number | null;
  groups_count?: number | null;
}

// Customer-facing description in standard Hebrew form. Only the שכבה (grade)
// field drives the prefix — the class field was removed from the UI to avoid
// confusion. class_label still exists in the DB for backward compatibility but
// is no longer rendered.
//   "כיתה ה- 12 מפגשים"            ← grade is filled
//   "כיתה ה- 12 מפגשים | 3 קבוצות" ← + multiple groups
//   "12 מפגשים"                    ← grade not set
export const buildDescription = (input: DescriptionInput): string => {
  const grade    = (input.grade_label ?? '').trim();
  const meetings = Number(input.meetings_count) || 0;
  const groups   = Number(input.groups_count) || 0;

  const parts: string[] = [];
  if (grade && meetings > 0) {
    parts.push(`כיתה ${grade}- ${meetings} מפגשים`);
  } else if (grade) {
    parts.push(`כיתה ${grade}`);
  } else if (meetings > 0) {
    parts.push(`${meetings} מפגשים`);
  }

  if (groups > 1) parts.push(`${groups} קבוצות`);

  return parts.join(' | ');
};
