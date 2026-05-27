// Region constants used for filtering and color coding orders on the
// (future) Calendar Board. Stored as TEXT in the DB; constrained to this
// list in the UI.
//
// Tailwind color tokens used here are read-only labels — the consumer
// (e.g. a <Badge>) picks how to render them. We expose both:
//   - badgeClass: utility classes for a colored Badge (light bg, dark text)
//   - dotColor: a single HSL/hex for legend dots and calendar markers

export interface RegionDef {
  value: string;
  badgeClass: string;
  dotColor: string;
}

export const REGIONS: readonly RegionDef[] = [
  { value: 'צפון',            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', dotColor: '#059669' },
  { value: 'חיפה והקריות',     badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',         dotColor: '#0d9488' },
  { value: 'שרון',            badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',         dotColor: '#0891b2' },
  { value: 'מרכז',            badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',         dotColor: '#2563eb' },
  { value: 'ירושלים',         badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',   dotColor: '#7c3aed' },
  { value: 'שפלה',            badgeClass: 'bg-pink-100 text-pink-800 border-pink-200',         dotColor: '#db2777' },
  { value: 'דרום',            badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',      dotColor: '#d97706' },
  { value: 'אילת',            badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',   dotColor: '#ea580c' },
] as const;

export type Region = (typeof REGIONS)[number]['value'];

export const REGION_VALUES: readonly string[] = REGIONS.map((r) => r.value);

export function regionDef(value: string | null | undefined): RegionDef | undefined {
  if (!value) return undefined;
  return REGIONS.find((r) => r.value === value);
}

export function isValidRegion(value: string): value is Region {
  return REGION_VALUES.includes(value);
}
