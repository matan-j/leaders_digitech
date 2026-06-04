ALTER TABLE public.system_defaults
ADD COLUMN IF NOT EXISTS rewards_page_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.system_defaults
SET rewards_page_enabled = TRUE
WHERE rewards_page_enabled IS NULL;
