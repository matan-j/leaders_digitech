/**
 * Business-level constants for Leader App.
 *
 * Phase Modularity Level 1A (V6): created as a centralized source of truth.
 * NOT yet wired into existing business calculations — existing literals
 * (e.g. `* 100` in Reports.tsx, `* 150` in Dashboard.tsx, `< 70` in
 * LessonReport.tsx) are intentionally left as-is.
 *
 * IMPORTANT: DEFAULT_INSTRUCTOR_COST_PER_LESSON (₪100) and
 * DEFAULT_REVENUE_PER_LESSON (₪150) are SEPARATE business concepts — they
 * represent different sides of the same lesson (cost vs. revenue) and must
 * not be merged or unified into a single constant.
 */

/** TODO Future Level 2: move to organization_settings (per-org configurable). */
export const DEFAULT_INSTRUCTOR_COST_PER_LESSON = 100;

/** TODO Future Level 2: move to organization_settings (per-org configurable). */
export const DEFAULT_REVENUE_PER_LESSON = 150;

/** TODO Future Level 2: move to organization_settings (per-org configurable). */
export const LOW_ATTENDANCE_THRESHOLD_DEFAULT = 70;

/** TODO Future Level 2: move to organization_settings (per-org configurable). */
export const DEFAULT_LESSON_DURATION_MINUTES = 45;

/** TODO Future Level 2: move to organization_settings (per-org configurable). */
export const DEFAULT_TASK_DURATION_MINUTES = 15;
