ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'אחר';
