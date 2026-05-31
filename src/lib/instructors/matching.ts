// Instructor matching: scores an instructor row against a placement context.
// Used by FindMatchingInstructorDialog and the instructor profile's
// "Find matching placement" entry point.

import { getRegionByCity, normalizeCity, type RegionKey } from './regions';

export interface MatchableInstructor {
  id: string;
  city: string | null;
  region: string | null;
  subjects: string[] | null;
  audiences: string[] | null;
  availability_days: number[] | null;
  rating_score: number | null;
  current_load?: number | null;
}

export interface MatchContext {
  city?: string | null;
  region?: RegionKey | string | null;
  subjects?: string[];
  audiences?: string[];
  day_of_week?: number | null;
}

export type MatchBucket = 'high' | 'medium' | 'low';

export interface MatchResult {
  score: number;        // 0..100
  bucket: MatchBucket;
  bucketLabel: string;  // Hebrew label
  reasons: string[];    // human-readable hits ("עיר תואמת", "תחום: מתמטיקה")
}

const labelForBucket = (b: MatchBucket): string =>
  b === 'high' ? 'התאמה גבוהה' : b === 'medium' ? 'התאמה בינונית' : 'התאמה נמוכה';

const bucketFor = (score: number): MatchBucket =>
  score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

const overlap = (a?: string[] | null, b?: string[] | null): string[] => {
  if (!a || !b || a.length === 0 || b.length === 0) return [];
  const setB = new Set(b.map((x) => x.trim()));
  return a.filter((x) => setB.has(x.trim()));
};

export function computeMatchScore(
  instructor: MatchableInstructor,
  context: MatchContext
): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Location: city +30 (best), else region +20.
  const wantedCity = normalizeCity(context.city ?? '');
  const wantedRegion = context.region ?? (wantedCity ? getRegionByCity(wantedCity) : null);
  const haveCity = normalizeCity(instructor.city ?? '');
  if (wantedCity && haveCity && haveCity === wantedCity) {
    score += 30;
    reasons.push(`עיר תואמת: ${haveCity}`);
  } else if (wantedRegion && instructor.region && instructor.region === wantedRegion) {
    score += 20;
    reasons.push('אזור תואם');
  }

  // 2. Subjects: up to +25 proportional.
  if (context.subjects && context.subjects.length > 0) {
    const hits = overlap(instructor.subjects, context.subjects);
    if (hits.length > 0) {
      const ratio = hits.length / context.subjects.length;
      const subjectScore = Math.round(25 * Math.min(1, ratio));
      score += subjectScore;
      reasons.push(`תחומים: ${hits.slice(0, 3).join(', ')}`);
    }
  }

  // 3. Audiences: up to +15 proportional.
  if (context.audiences && context.audiences.length > 0) {
    const hits = overlap(instructor.audiences, context.audiences);
    if (hits.length > 0) {
      const ratio = hits.length / context.audiences.length;
      const audienceScore = Math.round(15 * Math.min(1, ratio));
      score += audienceScore;
      reasons.push(`קהל יעד: ${hits.slice(0, 2).join(', ')}`);
    }
  }

  // 4. Availability day: +15 if instructor lists the requested day.
  if (context.day_of_week !== undefined && context.day_of_week !== null) {
    if ((instructor.availability_days ?? []).includes(context.day_of_week)) {
      score += 15;
      reasons.push('זמין ביום המבוקש');
    }
  }

  // 5. Rating: +10 × (rating/5).
  if (instructor.rating_score !== null && instructor.rating_score !== undefined) {
    const r = Math.max(0, Math.min(5, instructor.rating_score));
    const ratingScore = Math.round(10 * (r / 5));
    score += ratingScore;
    if (r >= 4) reasons.push(`ציון גבוה: ${r.toFixed(1)}`);
  }

  // 6. Low current_load bonus.
  const load = instructor.current_load ?? null;
  if (load !== null) {
    if (load < 3) {
      score += 5;
      reasons.push('עומס נמוך');
    } else if (load < 6) {
      score += 2;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const bucket = bucketFor(score);
  return { score, bucket, bucketLabel: labelForBucket(bucket), reasons };
}

export const compareByMatchScoreDesc = (
  a: { _match: MatchResult },
  b: { _match: MatchResult }
): number => b._match.score - a._match.score;
