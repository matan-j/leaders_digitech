-- Phase Modularity Level 1A (V6) — Safe Config Extraction
--
-- Adds nullable columns to system_defaults so that frontend code can read
-- business constants from DB if present, otherwise fall back to the
-- centralized constants in /src/constants/business.ts.
--
-- NOTE (V6 scope): This migration is FILE-ONLY and MUST NOT be run in
-- production yet. See supabase/migrations/PENDING_APPROVAL.md for the
-- manual approval workflow.
--
-- Frontend wiring (reading these columns) is intentionally deferred to a
-- future Level (1B / 2). Today the constants in business.ts are the source
-- of truth and the existing hardcoded literals in the codebase remain
-- unchanged.

ALTER TABLE public.system_defaults
  ADD COLUMN IF NOT EXISTS instructor_cost_per_lesson NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_per_lesson NUMERIC,
  ADD COLUMN IF NOT EXISTS low_attendance_threshold INTEGER;

COMMENT ON COLUMN public.system_defaults.instructor_cost_per_lesson IS
  'Default cost paid to the instructor per lesson, in ILS. Mirrors DEFAULT_INSTRUCTOR_COST_PER_LESSON in /src/constants/business.ts. Nullable — code falls back to constant when null.';
COMMENT ON COLUMN public.system_defaults.revenue_per_lesson IS
  'Default revenue charged to the customer per lesson, in ILS. Mirrors DEFAULT_REVENUE_PER_LESSON in /src/constants/business.ts. Nullable — code falls back to constant when null. Distinct from instructor_cost_per_lesson.';
COMMENT ON COLUMN public.system_defaults.low_attendance_threshold IS
  'Attendance percentage (0-100) below which low-attendance notifications are triggered. Mirrors LOW_ATTENDANCE_THRESHOLD_DEFAULT in /src/constants/business.ts. Nullable — code falls back to constant when null.';
