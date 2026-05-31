// Region taxonomy + city→region mapping for the Instructors & Lecturers CRM module.
// Single source of truth. Tabs, badges, profile header, match cards, CSV preview
// all read colors and labels from REGIONS. No hardcoded region colors elsewhere.

export type RegionKey =
  | 'center'
  | 'tel_aviv'
  | 'sharon'
  | 'shfela'
  | 'jerusalem'
  | 'north'
  | 'south'
  | 'haifa'
  | 'remote';

export interface RegionDef {
  key: RegionKey;
  label: string;
  badgeClass: string;       // colored pill used in tables, cards, profile header
  tabActiveClass: string;   // active region tab styling
  dotClass: string;         // small colored dot for compact rows
  countBadgeClass: string;  // count chip next to tab label
}

export const REGIONS: RegionDef[] = [
  {
    key: 'center',
    label: 'מרכז',
    badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200',
    tabActiveClass: 'bg-purple-50 text-purple-800 border-purple-300',
    dotClass: 'bg-purple-500',
    countBadgeClass: 'bg-purple-100 text-purple-700',
  },
  {
    key: 'tel_aviv',
    label: 'תל אביב והסביבה',
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
    tabActiveClass: 'bg-blue-50 text-blue-800 border-blue-300',
    dotClass: 'bg-blue-500',
    countBadgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'sharon',
    label: 'שרון',
    badgeClass: 'bg-teal-100 text-teal-800 border border-teal-200',
    tabActiveClass: 'bg-teal-50 text-teal-800 border-teal-300',
    dotClass: 'bg-teal-500',
    countBadgeClass: 'bg-teal-100 text-teal-700',
  },
  {
    key: 'shfela',
    label: 'שפלה',
    badgeClass: 'bg-green-100 text-green-800 border border-green-200',
    tabActiveClass: 'bg-green-50 text-green-800 border-green-300',
    dotClass: 'bg-green-500',
    countBadgeClass: 'bg-green-100 text-green-700',
  },
  {
    key: 'jerusalem',
    label: 'ירושלים',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    tabActiveClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
    countBadgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'north',
    label: 'צפון',
    badgeClass: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
    tabActiveClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    dotClass: 'bg-cyan-500',
    countBadgeClass: 'bg-cyan-100 text-cyan-700',
  },
  {
    key: 'south',
    label: 'דרום',
    badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200',
    tabActiveClass: 'bg-orange-50 text-orange-800 border-orange-300',
    dotClass: 'bg-orange-500',
    countBadgeClass: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'haifa',
    label: 'חיפה והקריות',
    badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    tabActiveClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    dotClass: 'bg-indigo-500',
    countBadgeClass: 'bg-indigo-100 text-indigo-700',
  },
  {
    key: 'remote',
    label: 'אונליין / מרחוק',
    badgeClass: 'bg-gray-100 text-gray-800 border border-gray-200',
    tabActiveClass: 'bg-gray-50 text-gray-800 border-gray-300',
    dotClass: 'bg-gray-500',
    countBadgeClass: 'bg-gray-100 text-gray-700',
  },
];

// Hebrew city → RegionKey. Extend as needed. Keys are normalized (no punctuation,
// collapsed whitespace) so callers must run normalizeCity first.
export const CITY_TO_REGION: Record<string, RegionKey> = {
  // Tel Aviv & surroundings
  'תל אביב': 'tel_aviv',
  'תל אביב יפו': 'tel_aviv',
  'תל אביב-יפו': 'tel_aviv',
  'רמת גן': 'tel_aviv',
  'גבעתיים': 'tel_aviv',
  'הרצליה': 'tel_aviv',
  'בני ברק': 'tel_aviv',
  'בת ים': 'tel_aviv',
  'חולון': 'tel_aviv',

  // Sharon
  'רעננה': 'sharon',
  'כפר סבא': 'sharon',
  'הוד השרון': 'sharon',
  'רמת השרון': 'sharon',
  'הרצליה פיתוח': 'sharon',
  'נתניה': 'sharon',
  'קדימה': 'sharon',
  'צורן': 'sharon',
  'אבן יהודה': 'sharon',

  // Shfela
  'ראשון לציון': 'shfela',
  'רחובות': 'shfela',
  'נס ציונה': 'shfela',
  'גדרה': 'shfela',
  'יבנה': 'shfela',
  'לוד': 'shfela',
  'רמלה': 'shfela',

  // Jerusalem
  'ירושלים': 'jerusalem',
  'מודיעין': 'jerusalem',
  'מודיעין מכבים רעות': 'jerusalem',
  'בית שמש': 'jerusalem',
  'מעלה אדומים': 'jerusalem',
  'בית אל': 'jerusalem',

  // Haifa & Krayot
  'חיפה': 'haifa',
  'קריית ים': 'haifa',
  'קריית אתא': 'haifa',
  'קריית מוצקין': 'haifa',
  'קריית ביאליק': 'haifa',
  'קריות': 'haifa',
  'טירת כרמל': 'haifa',
  'נשר': 'haifa',

  // North
  'צפת': 'north',
  'טבריה': 'north',
  'כרמיאל': 'north',
  'נצרת': 'north',
  'נצרת עילית': 'north',
  'נוף הגליל': 'north',
  'עכו': 'north',
  'נהריה': 'north',
  'מעלות תרשיחא': 'north',
  'קריית שמונה': 'north',
  'יקנעם': 'north',
  'יקנעם עילית': 'north',
  'עפולה': 'north',
  'בית שאן': 'north',
  'מגדל העמק': 'north',

  // South
  'באר שבע': 'south',
  'אשדוד': 'south',
  'אשקלון': 'south',
  'אילת': 'south',
  'דימונה': 'south',
  'נתיבות': 'south',
  'אופקים': 'south',
  'שדרות': 'south',
  'ערד': 'south',
  'קריית גת': 'south',
  'מצפה רמון': 'south',
  'ירוחם': 'south',

  // Center (non-TA non-Sharon)
  'פתח תקווה': 'center',
  'ראש העין': 'center',
  'יהוד': 'center',
  'יהוד מונוסון': 'center',
  'אור יהודה': 'center',
  'אלעד': 'center',
  'גני תקווה': 'center',
  'קריית אונו': 'center',
  'שוהם': 'center',
};

// ── helpers ───────────────────────────────────────────────────

export function normalizeCity(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/["׳״'’`,.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRegionByCity(city: string | null | undefined): RegionKey | null {
  const key = normalizeCity(city);
  if (!key) return null;
  if (CITY_TO_REGION[key]) return CITY_TO_REGION[key];
  // Try a looser match: city contains a known city name (e.g. "תל אביב 6").
  for (const [name, region] of Object.entries(CITY_TO_REGION)) {
    if (key.includes(name)) return region;
  }
  return null;
}

export function getRegionDef(key: RegionKey | string | null | undefined): RegionDef | null {
  if (!key) return null;
  return REGIONS.find((r) => r.key === key) ?? null;
}

export function getRegionLabel(key: RegionKey | string | null | undefined): string {
  return getRegionDef(key)?.label ?? '';
}

export function getRegionColor(
  key: RegionKey | string | null | undefined
): { badgeClass: string; dotClass: string; countBadgeClass: string } {
  const def = getRegionDef(key);
  if (def) return { badgeClass: def.badgeClass, dotClass: def.dotClass, countBadgeClass: def.countBadgeClass };
  return {
    badgeClass: 'bg-gray-50 text-gray-600 border border-gray-200',
    dotClass: 'bg-gray-300',
    countBadgeClass: 'bg-gray-100 text-gray-600',
  };
}

export const REGION_KEYS: RegionKey[] = REGIONS.map((r) => r.key);
