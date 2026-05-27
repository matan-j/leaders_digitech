-- Academic Year Orders — Phase 1, Migration 01/05
-- Creates the academic_year_orders table only.
-- Triggers, RPC, and RLS policies are in subsequent migrations (04 + 05).
--
-- Scope: a new planning layer that sits UNDER educational_institutions.
-- An academic year order represents a client's planned activity for a specific
-- academic year (תשפ"ה / תשפ"ו / תשפ"ז). It does NOT replace any existing
-- entity (crm_opportunities, quotes, course_instances) and does NOT touch
-- any existing business table.

CREATE TABLE IF NOT EXISTS public.academic_year_orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id            UUID NOT NULL
                              REFERENCES public.educational_institutions(id) ON DELETE RESTRICT,

  -- Academic year as text. Constants enforced in frontend (src/lib/academicYearOrders/academic-years.ts).
  -- Values: 'תשפ"ה' / 'תשפ"ו' / 'תשפ"ז' / 'תשפ"ח'
  academic_year             TEXT NOT NULL,

  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft',
                                'pending_approval',
                                'approved',
                                'scheduling',
                                'scheduled',
                                'cancelled',
                                'archived'
                              )),

  -- Optional links back to the sales/proposal layer (read-only references; never required)
  source_quote_id           UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  source_opportunity_id     UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,

  -- Aggregate planning numbers (per-group detail lives in academic_year_order_groups)
  groups_count_planned      INTEGER CHECK (groups_count_planned IS NULL OR groups_count_planned >= 0),
  total_meetings_planned    INTEGER CHECK (total_meetings_planned IS NULL OR total_meetings_planned >= 0),
  hours_per_meeting         NUMERIC(4,2) CHECK (hours_per_meeting IS NULL OR hours_per_meeting > 0),

  city                      TEXT,
  region                    TEXT,

  preferred_instructor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  requested_start_date      DATE,
  requested_end_date        DATE,
  CONSTRAINT chk_ayo_date_range CHECK (
    requested_end_date IS NULL
    OR requested_start_date IS NULL
    OR requested_end_date >= requested_start_date
  ),

  scheduling_status         TEXT NOT NULL DEFAULT 'not_started'
                              CHECK (scheduling_status IN ('not_started', 'partial', 'complete')),

  notes                     TEXT,

  created_by                UUID REFERENCES auth.users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                UUID REFERENCES auth.users(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: only ONE active order per (institution, academic_year).
-- Cancelled or archived orders free the slot so a new active order can be created.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_order_per_year
  ON public.academic_year_orders (institution_id, academic_year)
  WHERE status NOT IN ('cancelled', 'archived');

CREATE INDEX IF NOT EXISTS idx_ayo_institution
  ON public.academic_year_orders(institution_id);

CREATE INDEX IF NOT EXISTS idx_ayo_year
  ON public.academic_year_orders(academic_year);

CREATE INDEX IF NOT EXISTS idx_ayo_status
  ON public.academic_year_orders(status);

CREATE INDEX IF NOT EXISTS idx_ayo_preferred_instructor
  ON public.academic_year_orders(preferred_instructor_id)
  WHERE preferred_instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ayo_region
  ON public.academic_year_orders(region)
  WHERE region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ayo_scheduling_status
  ON public.academic_year_orders(scheduling_status);

COMMENT ON TABLE public.academic_year_orders IS
  'Planning layer: a client''s annual order for an academic year (תשפ"ה/תשפ"ו/תשפ"ז). Lives under an institution. Not a sales deal (crm_opportunities) and not a proposal (quotes). Per-group detail lives in academic_year_order_groups.';
