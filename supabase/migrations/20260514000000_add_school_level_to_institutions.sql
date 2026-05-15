-- =============================================================
-- Add school_level classification to educational_institutions
-- Date: 2026-05-14
-- Additive only — nullable, no defaults, safe for existing rows.
-- Values:
--   'elementary' = יסודי (K-6)
--   'secondary'  = על יסודי (חט"ב + תיכון)
-- =============================================================

ALTER TABLE public.educational_institutions
  ADD COLUMN IF NOT EXISTS school_level TEXT
    CHECK (school_level IN ('elementary', 'secondary'));

CREATE INDEX IF NOT EXISTS idx_institutions_school_level
  ON public.educational_institutions(school_level);
