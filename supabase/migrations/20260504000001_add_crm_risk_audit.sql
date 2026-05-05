-- =============================================================
-- Track when crm_risk (the "סטטוס" column in the CRM UI) changes.
-- Values: 'high' = לא שוחחנו, 'medium' = בתהליך, 'low' = שוחחנו.
--
-- Adds a timestamp column + extends the existing trigger to also
-- bump it when crm_risk changes. Used by the daily Telegram report
-- to count real "lead status" transitions in a 24h window.
-- =============================================================

-- 1. Add the timestamp column (nullable so existing rows are valid).
ALTER TABLE public.educational_institutions
  ADD COLUMN IF NOT EXISTS crm_risk_updated_at TIMESTAMPTZ NULL;

-- 2. Replace the trigger function to also handle crm_risk.
--    Same DISTINCT FROM logic — only bumps on actual change.
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
  IF NEW.crm_risk IS DISTINCT FROM OLD.crm_risk THEN
    NEW.crm_risk_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger trg_bump_crm_stage_class_timestamps already exists from
-- 20260504000000 — it will pick up the updated function automatically.

-- 3. Index for the daily report's window query.
CREATE INDEX IF NOT EXISTS idx_institutions_crm_risk_updated_at
  ON public.educational_institutions(crm_risk_updated_at);
