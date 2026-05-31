// Shared validation + parsing helpers for the Instructors CRM module.

import { getRegionByCity, normalizeCity, REGION_KEYS, type RegionKey } from './regions';

export type RoleType = 'instructor' | 'lecturer' | 'facilitator' | 'trainer' | 'speaker';
export type EmploymentType = 'freelance' | 'employee' | 'contractor';
export type InstructorStatus = 'active' | 'inactive' | 'on_hold' | 'candidate';

export const ROLE_TYPES: RoleType[] = ['instructor', 'lecturer', 'facilitator', 'trainer', 'speaker'];
export const EMPLOYMENT_TYPES: EmploymentType[] = ['freelance', 'employee', 'contractor'];
export const INSTRUCTOR_STATUSES: InstructorStatus[] = ['active', 'inactive', 'on_hold', 'candidate'];

export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  instructor: 'מדריך',
  lecturer: 'מרצה',
  facilitator: 'מנחה',
  trainer: 'מאמן',
  speaker: 'דובר',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  freelance: 'פרילנס',
  employee: 'שכיר',
  contractor: 'קבלן',
};

export const STATUS_LABEL: Record<InstructorStatus, string> = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  on_hold: 'בהמתנה',
  candidate: 'מועמד',
};

export const STATUS_BADGE: Record<InstructorStatus, { color: string; bg: string }> = {
  active:    { color: '#15803D', bg: '#DCFCE7' },
  inactive:  { color: '#6B7280', bg: '#F3F4F6' },
  on_hold:   { color: '#D97706', bg: '#FEF3C7' },
  candidate: { color: '#2563EB', bg: '#DBEAFE' },
};

// Suggested quality tags shown in the picker.
export const QUALITY_TAG_SUGGESTIONS = [
  'חזק מול תלמידים',
  'מתאים למורים',
  'מתאים למנהלים',
  'דורש ליווי',
  'מקצועי מאוד',
  'זמינות גבוהה',
  'תקשורת טובה',
  'מתאים לקבוצות מורכבות',
];

// ── input parsing ────────────────────────────────────────────

export const splitList = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export const parseDays = (raw: string | null | undefined): number[] => {
  if (!raw) return [];
  return splitList(raw)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
};

const HEBREW_PHONE_RE = /^[0-9+\-\s()]+$/;

export const normalizePhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned || null;
};

export const normalizeEmail = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  return raw.trim().toLowerCase() || null;
};

export const parseNumeric = (raw: string | number | null | undefined): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ── high-level row validation ────────────────────────────────

export interface InstructorInput {
  full_name: string;
  role_type?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  travel_radius_km?: number | null;
  subjects?: string[];
  audiences?: string[];
  languages?: string[];
  availability_days?: number[];
  availability_hours?: unknown;
  hourly_rate?: number | null;
  hourly_rate_notes?: string | null;
  employment_type?: string | null;
  status?: string | null;
  rating_score?: number | null;
  rating_notes?: string | null;
  quality_tags?: string[];
  notes?: string | null;
}

export interface ValidationIssue {
  field: keyof InstructorInput | 'general';
  message: string;
  level: 'error' | 'warning';
}

export const validateInstructor = (input: InstructorInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!input.full_name || !input.full_name.trim()) {
    issues.push({ field: 'full_name', message: 'שם מלא הוא שדה חובה', level: 'error' });
  }
  if (!input.city || !input.city.trim()) {
    issues.push({ field: 'city', message: 'עיר היא שדה חובה', level: 'error' });
  }
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) {
    issues.push({ field: 'general', message: 'יש להזין טלפון או אימייל', level: 'error' });
  }
  if (input.phone && !HEBREW_PHONE_RE.test(input.phone)) {
    issues.push({ field: 'phone', message: 'מספר טלפון לא תקין', level: 'warning' });
  }
  if (input.hourly_rate !== null && input.hourly_rate !== undefined && !Number.isFinite(input.hourly_rate)) {
    issues.push({ field: 'hourly_rate', message: 'תעריף לא תקין', level: 'error' });
  }
  if (input.travel_radius_km !== null && input.travel_radius_km !== undefined && !Number.isFinite(input.travel_radius_km)) {
    issues.push({ field: 'travel_radius_km', message: 'רדיוס נסיעה לא תקין', level: 'error' });
  }
  if (input.rating_score !== null && input.rating_score !== undefined) {
    if (!Number.isFinite(input.rating_score) || input.rating_score < 1 || input.rating_score > 5) {
      issues.push({ field: 'rating_score', message: 'ציון חייב להיות בין 1 ל-5', level: 'error' });
    }
  }
  if (input.status && !INSTRUCTOR_STATUSES.includes(input.status as InstructorStatus)) {
    issues.push({ field: 'status', message: `סטטוס לא תקין: ${input.status}`, level: 'warning' });
  }
  if (input.region && !REGION_KEYS.includes(input.region as RegionKey)) {
    issues.push({ field: 'region', message: `אזור לא מזוהה: ${input.region}`, level: 'warning' });
  }
  if (input.city && input.region) {
    const auto = getRegionByCity(input.city);
    if (auto && auto !== input.region) {
      issues.push({
        field: 'region',
        message: `אזור שהועלה לא תואם למיפוי לפי העיר (${auto}). האזור המועלה ישמר.`,
        level: 'warning',
      });
    }
  }
  if (input.city && !input.region) {
    const auto = getRegionByCity(input.city);
    if (!auto) {
      issues.push({
        field: 'city',
        message: `עיר '${normalizeCity(input.city)}' לא נמצאת במיפוי. ניתן לערוך לאחר ייבוא.`,
        level: 'warning',
      });
    }
  }
  return issues;
};

export const hasErrors = (issues: ValidationIssue[]): boolean =>
  issues.some((i) => i.level === 'error');
