// Academic year constants. Stored as TEXT in the DB; constrained to this list
// in the UI by rendering a <Select> instead of free input.
//
// Order matters: the first entry is the default for new orders. Add the
// next year at the end of the array; trim past years when they're no longer
// planning-relevant.

export const ACADEMIC_YEARS = [
  'תשפ"ז',
  'תשפ"ח',
] as const;

export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

// Default new orders to the current academic year. Hebrew academic years
// begin in September, so from Sep–Dec we are already in the next year.
export function currentAcademicYear(): AcademicYear {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Sep (8) onwards = next academic year on Hebrew calendar
  // This is a rough approximation; for a precise mapping, consult the Hebrew calendar.
  const index = month >= 8 ? 1 : 0;
  return ACADEMIC_YEARS[index] ?? ACADEMIC_YEARS[0];
}

export function isValidAcademicYear(value: string): value is AcademicYear {
  return (ACADEMIC_YEARS as readonly string[]).includes(value);
}
