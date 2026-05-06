-- =============================================================
-- Track when crm_stage / crm_class change on educational_institutions.
-- Adds two timestamp columns + a BEFORE UPDATE trigger that bumps them
-- only when the relevant value actually changes (no no-op writes).
--
-- Used by the daily Telegram execution report to count real "lead
-- moved status" events in a time window — solves the schema gap where
-- there was no historical record of when a stage transition occurred.
-- =============================================================

-- 1. Add the timestamp columns (nullable so existing rows are valid).
ALTER TABLE public.educational_institutions
  ADD COLUMN IF NOT EXISTS crm_stage_updated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS crm_class_updated_at TIMESTAMPTZ NULL;

-- 2. Trigger function — bumps timestamps only on actual change.
CREATE OR REPLACE FUNCTION public.bump_crm_stage_class_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crm_stage IS DISTINCT FROM OLD.crm_stage THEN
    NEW.crm_stage_updated_at := NOW();
  END IF;
  IF NEW.crm_class IS DISTINCT FROM OLD.crm_class THEN
    NEW.crm_class_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_bump_crm_stage_class_timestamps
  ON public.educational_institutions;

CREATE TRIGGER trg_bump_crm_stage_class_timestamps
  BEFORE UPDATE ON public.educational_institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_crm_stage_class_timestamps();

-- 4. Helpful index for the daily report's window query.
CREATE INDEX IF NOT EXISTS idx_institutions_crm_stage_updated_at
  ON public.educational_institutions(crm_stage_updated_at);

CREATE INDEX IF NOT EXISTS idx_institutions_crm_class_updated_at
  ON public.educational_institutions(crm_class_updated_at);
