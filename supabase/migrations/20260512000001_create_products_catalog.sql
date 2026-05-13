-- Products catalog — separate from courses (sales items with VAT-inclusive pricing)
-- Customer = educational_institutions; products are referenced from quote_lines (next migration).

CREATE TABLE IF NOT EXISTS public.products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  short_description TEXT,
  price_excl_vat    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_excl_vat >= 0),
  vat_rate          NUMERIC(5,2)  NOT NULL DEFAULT 18 CHECK (vat_rate >= 0),
  price_incl_vat    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_incl_vat >= 0),
  website_url       TEXT,
  syllabus_url      TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  internal_notes    TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);
CREATE INDEX IF NOT EXISTS products_sort_idx   ON public.products(sort_order);

-- Shared updated_at helper (idempotent — does nothing if it already exists with same body)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- read: any authenticated user
CREATE POLICY products_read ON public.products
  FOR SELECT TO authenticated USING (true);

-- write: admin + pedagogical_manager
CREATE POLICY products_write ON public.products
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager'))
  WITH CHECK (public.get_current_user_role() IN ('admin','pedagogical_manager'));

-- Seed default_vat_rate into the existing crm_settings key-value store
INSERT INTO public.crm_settings (key, value)
  VALUES ('default_vat_rate', '18')
  ON CONFLICT (key) DO NOTHING;
