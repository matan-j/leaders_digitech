-- Backfill NULL crm_stage for existing Leads and Customers
-- Additive only — no schema changes.

UPDATE public.educational_institutions
SET crm_stage = 'יצירת קשר'
WHERE crm_stage IS NULL
  AND crm_class IN ('Lead', 'Customer');
