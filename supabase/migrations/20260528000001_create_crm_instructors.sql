-- Phase 1 — Instructors & Lecturers CRM module.
--
-- A talent directory that lives alongside `profiles`. CRM instructors may or may
-- not have an auth account: external lecturers, freelance speakers, candidates
-- being evaluated. When they do have a login, `profile_id` links to the existing
-- `profiles` row so the talent DB and operational scheduling stay in sync.
--
-- Phase 1 is purely additive — existing pickers (AssignInstructorModal,
-- preferred_instructor_id, course_instances.instructor_id) continue to read
-- from `profiles`. Rewiring those flows to consume `instructors` is a follow-up
-- phase.

-- ─── instructors ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instructors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name          TEXT NOT NULL,
  role_type          TEXT,
  phone              TEXT,
  email              TEXT,
  city               TEXT NOT NULL,
  region             TEXT,
  address            TEXT,
  travel_radius_km   INTEGER,
  subjects           TEXT[] NOT NULL DEFAULT '{}',
  audiences          TEXT[] NOT NULL DEFAULT '{}',
  languages          TEXT[] NOT NULL DEFAULT '{}',
  availability_days  INTEGER[] NOT NULL DEFAULT '{}',
  availability_hours JSONB,
  hourly_rate        NUMERIC,
  hourly_rate_notes  TEXT,
  employment_type    TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  rating_score       NUMERIC,
  rating_notes       TEXT,
  quality_tags       TEXT[] NOT NULL DEFAULT '{}',
  notes              TEXT,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instructors_contact_present
    CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT instructors_rating_range
    CHECK (rating_score IS NULL OR (rating_score >= 1 AND rating_score <= 5))
);

CREATE INDEX IF NOT EXISTS idx_instructors_city         ON public.instructors(city);
CREATE INDEX IF NOT EXISTS idx_instructors_region       ON public.instructors(region);
CREATE INDEX IF NOT EXISTS idx_instructors_status       ON public.instructors(status);
CREATE INDEX IF NOT EXISTS idx_instructors_rating       ON public.instructors(rating_score);
CREATE INDEX IF NOT EXISTS idx_instructors_profile_id   ON public.instructors(profile_id);
CREATE INDEX IF NOT EXISTS idx_instructors_subjects     ON public.instructors USING GIN (subjects);
CREATE INDEX IF NOT EXISTS idx_instructors_audiences    ON public.instructors USING GIN (audiences);
CREATE INDEX IF NOT EXISTS idx_instructors_quality_tags ON public.instructors USING GIN (quality_tags);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_email_unique
  ON public.instructors (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_phone_unique
  ON public.instructors (phone) WHERE phone IS NOT NULL;

COMMENT ON TABLE public.instructors IS
  'CRM talent directory for instructors, lecturers, facilitators, trainers, speakers. Optionally linked to profiles for auth-backed users.';

-- ─── instructor_assignments (planning layer) ─────────────────────────────────
-- N:M between instructors and the operational entities they could be matched to.
-- No UI writes this in Phase 1 — future matching/scheduling screens will.

CREATE TABLE IF NOT EXISTS public.instructor_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id   UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  institution_id  UUID NULL REFERENCES public.educational_institutions(id)   ON DELETE SET NULL,
  course_id       UUID NULL REFERENCES public.courses(id)                    ON DELETE SET NULL,
  group_id        UUID NULL REFERENCES public.academic_year_order_groups(id) ON DELETE SET NULL,
  school_year     TEXT,
  day_of_week     INTEGER CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)),
  start_time      TIME,
  end_time        TIME,
  status          TEXT NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_assignments_instructor  ON public.instructor_assignments(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_assignments_institution ON public.instructor_assignments(institution_id);
CREATE INDEX IF NOT EXISTS idx_instructor_assignments_course      ON public.instructor_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_instructor_assignments_group       ON public.instructor_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_instructor_assignments_year        ON public.instructor_assignments(school_year);

COMMENT ON TABLE public.instructor_assignments IS
  'Planning-layer matches between instructors and institutions/courses/order groups. Phase 1: schema only, no UI writes.';

-- ─── updated_at trigger ──────────────────────────────────────────────────────
-- Reuse shared helper if it exists, otherwise create it (idempotent).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instructors_updated_at ON public.instructors;
CREATE TRIGGER instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS instructor_assignments_updated_at ON public.instructor_assignments;
CREATE TRIGGER instructor_assignments_updated_at
  BEFORE UPDATE ON public.instructor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── default created_by from auth.uid() ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_instructors_set_created_by()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instructors_set_created_by ON public.instructors;
CREATE TRIGGER instructors_set_created_by
  BEFORE INSERT ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.fn_instructors_set_created_by();

DROP TRIGGER IF EXISTS instructor_assignments_set_created_by ON public.instructor_assignments;
CREATE TRIGGER instructor_assignments_set_created_by
  BEFORE INSERT ON public.instructor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_instructors_set_created_by();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Admin + pedagogical_manager + sales_rep. Mirrors the academic-year-orders
-- pattern. The CRM UI itself is gated to admin/sales_rep at the route level;
-- PM read access at the DB level supports future tooling.

ALTER TABLE public.instructors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_assignments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instructors_select ON public.instructors;
CREATE POLICY instructors_select ON public.instructors
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructors_insert ON public.instructors;
CREATE POLICY instructors_insert ON public.instructors
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructors_update ON public.instructors;
CREATE POLICY instructors_update ON public.instructors
  FOR UPDATE TO authenticated
  USING      (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructors_delete ON public.instructors;
CREATE POLICY instructors_delete ON public.instructors
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructor_assignments_select ON public.instructor_assignments;
CREATE POLICY instructor_assignments_select ON public.instructor_assignments
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructor_assignments_insert ON public.instructor_assignments;
CREATE POLICY instructor_assignments_insert ON public.instructor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructor_assignments_update ON public.instructor_assignments;
CREATE POLICY instructor_assignments_update ON public.instructor_assignments
  FOR UPDATE TO authenticated
  USING      (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

DROP POLICY IF EXISTS instructor_assignments_delete ON public.instructor_assignments;
CREATE POLICY instructor_assignments_delete ON public.instructor_assignments
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager', 'sales_rep'));

-- ─── one-off backfill from profiles ──────────────────────────────────────────
-- Seed the CRM directory from existing auth-backed instructors so the talent
-- database starts populated. `profiles` currently has no city column, so all
-- backfilled rows get city='לא ידוע' and NULL region; admins can edit them
-- from the new UI. Skipped on conflict (e.g. if migration is re-run).

INSERT INTO public.instructors
  (profile_id, full_name, phone, email, city, role_type, status, hourly_rate)
SELECT
  p.id,
  p.full_name,
  p.phone,
  p.email,
  'לא ידוע',
  'instructor',
  'active',
  p.hourly_rate
FROM public.profiles p
WHERE p.role = 'instructor'
  AND p.full_name IS NOT NULL
  AND (p.phone IS NOT NULL OR p.email IS NOT NULL)
ON CONFLICT DO NOTHING;
