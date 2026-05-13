-- Quotes & quote_lines — attached to educational_institutions
-- Snapshot fields keep historical quotes stable even if institution / product / contact change.

CREATE TABLE IF NOT EXISTS public.quotes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id           UUID NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  quote_number             TEXT NOT NULL UNIQUE,
  issue_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until              DATE,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','ready','sent','approved','cancelled')),

  -- customer snapshot (frozen at creation time)
  customer_snapshot_name   TEXT NOT NULL,
  contact_snapshot_name    TEXT,
  contact_snapshot_phone   TEXT,
  contact_snapshot_email   TEXT,

  -- totals (all VAT-inclusive — display source of truth)
  subtotal_incl_vat        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  rounding_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_incl_vat           NUMERIC(12,2) NOT NULL DEFAULT 0,

  notes                    TEXT,
  terms_text               TEXT,

  -- summit-export readiness
  summit_export_status     TEXT DEFAULT 'pending'
                             CHECK (summit_export_status IN ('pending','exported','failed')),
  summit_export_reference  TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES auth.users(id),
  updated_by               UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS quotes_institution_idx ON public.quotes(institution_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS quotes_status_idx      ON public.quotes(status);


CREATE TABLE IF NOT EXISTS public.quote_lines (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id               UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id             UUID REFERENCES public.products(id) ON DELETE SET NULL,

  -- snapshot
  product_name_snapshot  TEXT NOT NULL,

  -- pedagogical context
  grade_label            TEXT,
  class_label            TEXT,
  description_text       TEXT,            -- auto-built, user-editable

  -- quantity math
  meetings_count         INT NOT NULL DEFAULT 1 CHECK (meetings_count > 0),
  hours_per_meeting      NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (hours_per_meeting > 0),
  groups_count           INT NOT NULL DEFAULT 1 CHECK (groups_count > 0),
  total_hours            NUMERIC(10,2) NOT NULL DEFAULT 1,

  -- pricing (VAT-inclusive throughout)
  hourly_rate_incl_vat   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hourly_rate_incl_vat >= 0),
  line_total_incl_vat    NUMERIC(12,2) NOT NULL DEFAULT 0,

  internal_notes         TEXT,

  -- summit-export columns (precomputed at save time)
  external_product_name  TEXT,
  external_description   TEXT,
  external_quantity      NUMERIC(10,2),
  external_price         NUMERIC(12,2),

  sort_order             INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quote_lines_quote_idx ON public.quote_lines(quote_id, sort_order);

DROP TRIGGER IF EXISTS quotes_updated_at ON public.quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS quote_lines_updated_at ON public.quote_lines;
CREATE TRIGGER quote_lines_updated_at
  BEFORE UPDATE ON public.quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quotes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines  ENABLE ROW LEVEL SECURITY;

-- quotes: read/write for admin + PM + sales_rep
CREATE POLICY quotes_read ON public.quotes
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'));

CREATE POLICY quotes_write ON public.quotes
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'))
  WITH CHECK (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'));

-- quote_lines: same roles, inherit visibility from parent quote
CREATE POLICY quote_lines_read ON public.quote_lines
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep')
    AND quote_id IN (SELECT id FROM public.quotes)
  );

CREATE POLICY quote_lines_write ON public.quote_lines
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'))
  WITH CHECK (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'));


-- Quote number allocator: year-prefixed sequence, atomic via UPSERT.
CREATE TABLE IF NOT EXISTS public.quote_counters (
  year        INT PRIMARY KEY,
  next_number INT NOT NULL DEFAULT 1001
);

ALTER TABLE public.quote_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_counters_read ON public.quote_counters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY quote_counters_write ON public.quote_counters
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'))
  WITH CHECK (public.get_current_user_role() IN ('admin','pedagogical_manager','sales_rep'));

CREATE OR REPLACE FUNCTION public.allocate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr  INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  num INT;
BEGIN
  INSERT INTO public.quote_counters AS qc (year, next_number)
    VALUES (yr, 1002)
    ON CONFLICT (year) DO UPDATE
      SET next_number = qc.next_number + 1
    RETURNING qc.next_number - 1 INTO num;

  RETURN 'Q-' || yr || '-' || num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_quote_number() TO authenticated;
