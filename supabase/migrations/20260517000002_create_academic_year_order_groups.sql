-- Academic Year Orders — Phase 1, Migration 02/05
-- Creates the academic_year_order_groups table only.
-- A group represents a single cohort/section under an order (one age range, one
-- requested time window). An order may contain many groups.
--
-- NOTE: This migration does NOT create a foreign key from a group to a specific
-- course_instance. Each group can scale to N course_instances at scheduling time
-- (groups_count >= 1). The N:M link table (academic_year_order_group_instances)
-- belongs to a future phase (Phase 8). For now scheduling_status on the group
-- is tracked manually.

CREATE TABLE IF NOT EXISTS public.academic_year_order_groups (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id                  UUID NOT NULL
                              REFERENCES public.academic_year_orders(id) ON DELETE CASCADE,

  course_id                 UUID REFERENCES public.courses(id) ON DELETE SET NULL,

  -- Free-text labels (e.g. 'כיתות ג''-ד''', 'תיכון')
  age_group                 TEXT,
  grade_label               TEXT,

  -- How many parallel groups of this same type the client wants
  groups_count              INTEGER NOT NULL DEFAULT 1 CHECK (groups_count >= 1),

  -- Requested days (0 = Sunday ... 6 = Saturday). Optional during draft.
  requested_days_of_week    INTEGER[],

  -- Requested time window. JSONB shape: {"from":"HH:MM","to":"HH:MM"}
  requested_time_window     JSONB,

  meetings_count            INTEGER CHECK (meetings_count IS NULL OR meetings_count >= 0),
  hours_per_meeting         NUMERIC(4,2) CHECK (hours_per_meeting IS NULL OR hours_per_meeting > 0),

  scheduling_status         TEXT NOT NULL DEFAULT 'pending'
                              CHECK (scheduling_status IN ('pending', 'scheduled', 'cancelled')),

  sort_order                INTEGER NOT NULL DEFAULT 0,
  notes                     TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Every value in requested_days_of_week must be 0..6 (Sun..Sat).
  CONSTRAINT chk_ayog_days_of_week_range CHECK (
    requested_days_of_week IS NULL
    OR requested_days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  ),

  -- requested_time_window must be a JSON object with `from` and `to` HH:MM strings, to > from.
  -- HH is 00..23, MM is 00..59. Lexicographic comparison works because both are zero-padded HH:MM.
  CONSTRAINT chk_ayog_time_window_shape CHECK (
    requested_time_window IS NULL
    OR (
      jsonb_typeof(requested_time_window) = 'object'
      AND (requested_time_window ? 'from')
      AND (requested_time_window ? 'to')
      AND jsonb_typeof(requested_time_window->'from') = 'string'
      AND jsonb_typeof(requested_time_window->'to')   = 'string'
      AND (requested_time_window->>'from') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND (requested_time_window->>'to')   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND (requested_time_window->>'to') > (requested_time_window->>'from')
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ayog_order
  ON public.academic_year_order_groups(order_id);

CREATE INDEX IF NOT EXISTS idx_ayog_scheduling_status
  ON public.academic_year_order_groups(scheduling_status);

COMMENT ON TABLE public.academic_year_order_groups IS
  'Child of academic_year_orders. One row per requested group/cohort. groups_count >= 1 lets a single row plan multiple parallel groups of the same type.';
