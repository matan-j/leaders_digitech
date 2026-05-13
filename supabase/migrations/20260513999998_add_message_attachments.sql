-- =============================================================
-- CRM: WhatsApp / Email message attachments
-- Date: 2026-05-13
-- Additive only. Adds an attachments JSONB column to:
--   - crm_communications  (history of sent messages)
--   - crm_message_templates (templates re-used in broadcasts)
--
-- Shape of each attachment:
--   { "name": "file.pdf", "url": "https://...", "mime_type": "application/pdf",
--     "size": 12345, "kind": "image" | "video" | "audio" | "document",
--     "storage_path": "crm-attachments/{institutionId}/..." }
-- =============================================================

ALTER TABLE public.crm_communications
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.crm_message_templates
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Helpful for filtering communications that include attachments
CREATE INDEX IF NOT EXISTS idx_crm_communications_has_attachments
  ON public.crm_communications ((jsonb_array_length(attachments) > 0))
  WHERE jsonb_array_length(attachments) > 0;
