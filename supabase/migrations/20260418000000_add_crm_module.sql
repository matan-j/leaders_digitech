-- =============================================================
-- CRM MODULE — Full Schema Migration
-- Date: 2026-04-18
-- Additive only. No existing columns modified or dropped.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Add sales_rep to the user_role enum
--    Note: ADD VALUE cannot be run inside a transaction block.
--    Supabase CLI applies this safely in its own step.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_rep';

-- ─────────────────────────────────────────────────────────────
-- 1. Extend educational_institutions with CRM fields
--    All columns nullable, no defaults — safe for existing rows
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.educational_institutions
  ADD COLUMN IF NOT EXISTS crm_class TEXT
    CHECK (crm_class IN ('Lead', 'Customer', 'Past Customer')),
  ADD COLUMN IF NOT EXISTS crm_stage TEXT
    CHECK (crm_stage IN ('יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד')),
  ADD COLUMN IF NOT EXISTS crm_owner_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_assigned_instructor_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_lead_source TEXT,
  ADD COLUMN IF NOT EXISTS crm_potential NUMERIC,
  ADD COLUMN IF NOT EXISTS crm_risk TEXT
    CHECK (crm_risk IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS crm_ai_score INTEGER,
  ADD COLUMN IF NOT EXISTS crm_last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crm_next_step TEXT,
  ADD COLUMN IF NOT EXISTS crm_next_step_date DATE,
  ADD COLUMN IF NOT EXISTS crm_interests TEXT[],
  ADD COLUMN IF NOT EXISTS crm_pain_points TEXT,
  ADD COLUMN IF NOT EXISTS crm_budget TEXT,
  ADD COLUMN IF NOT EXISTS crm_notes TEXT,
  ADD COLUMN IF NOT EXISTS crm_network TEXT;

-- Indexes for common CRM queries on institutions
CREATE INDEX IF NOT EXISTS idx_institutions_crm_class ON public.educational_institutions(crm_class);
CREATE INDEX IF NOT EXISTS idx_institutions_crm_stage ON public.educational_institutions(crm_stage);
CREATE INDEX IF NOT EXISTS idx_institutions_crm_owner ON public.educational_institutions(crm_owner_id);

-- ─────────────────────────────────────────────────────────────
-- 2. crm_contacts — normalized contacts table
--    Replaces JSONB contacts column for FK-able CRM references.
--    Existing JSONB column is left untouched.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  phone          TEXT,
  email          TEXT,
  role           TEXT,
  is_primary     BOOLEAN     DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_institution_id ON public.crm_contacts(institution_id);

-- ─────────────────────────────────────────────────────────────
-- 3. crm_opportunities
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  course_id          UUID        REFERENCES public.courses(id) ON DELETE SET NULL,
  stage              TEXT        NOT NULL DEFAULT 'יצירת קשר'
    CHECK (stage IN ('יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד')),
  status             TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost')),
  contact_id         UUID        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  value              NUMERIC,
  probability        INTEGER     CHECK (probability BETWEEN 0 AND 100),
  proposal_sent      BOOLEAN     DEFAULT FALSE,
  proposal_link      TEXT,
  groups             INTEGER,
  sessions           INTEGER,
  decision_date      DATE,
  loss_reason        TEXT,
  next_step          TEXT,
  next_step_date     DATE,
  ghl_opportunity_id TEXT,
  created_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opps_institution_id ON public.crm_opportunities(institution_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_stage          ON public.crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_opps_status         ON public.crm_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_crm_opps_created_by     ON public.crm_opportunities(created_by);

-- ─────────────────────────────────────────────────────────────
-- 4. crm_activities — interaction log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  opportunity_id UUID        REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  contact_id     UUID        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  type           TEXT        NOT NULL
    CHECK (type IN ('שיחה', 'מייל', 'פגישה', 'וואטסאפ', 'אחר')),
  summary        TEXT,
  outcome        TEXT,
  next_step      TEXT,
  next_step_date DATE,
  status         TEXT        NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open', 'Waiting', 'Completed')),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_institution_id ON public.crm_activities(institution_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_id ON public.crm_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user_id        ON public.crm_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_occurred_at    ON public.crm_activities(occurred_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. crm_followups — task queue
--    status: 'pending' | 'done'
--    'overdue' is computed client-side: due_date < today AND status = 'pending'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_followups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  opportunity_id UUID        REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  contact_id     UUID        REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  assigned_to    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  task           TEXT        NOT NULL,
  next_step      TEXT,
  due_date       DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_followups_institution_id ON public.crm_followups(institution_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_assigned_to    ON public.crm_followups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_followups_due_date       ON public.crm_followups(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_followups_status         ON public.crm_followups(status);

-- ─────────────────────────────────────────────────────────────
-- 6. crm_message_templates
--    stage nullable = template applies to all stages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_message_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  stage      TEXT        CHECK (stage IN ('יצירת קשר', 'מעוניין', 'סגירה', 'זכה', 'הפסיד')),
  channel    TEXT        NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  subject    TEXT,
  body       TEXT        NOT NULL,
  variables  TEXT[]      DEFAULT '{}',
  is_default BOOLEAN     DEFAULT FALSE,
  created_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. crm_broadcasts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_broadcasts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  channel         TEXT        NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  template_id     UUID        REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
  audience_type   TEXT        NOT NULL,
  audience_filter JSONB       DEFAULT '{}',
  recipient_count INTEGER     DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'failed')),
  sent_at         TIMESTAMPTZ,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_status     ON public.crm_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_created_by ON public.crm_broadcasts(created_by);

-- ─────────────────────────────────────────────────────────────
-- 8. crm_ghl_sync — institution-level GHL contact sync
--    ghl_opportunity_id lives on crm_opportunities (one per opp, not per institution)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_ghl_sync (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.educational_institutions(id) ON DELETE CASCADE,
  ghl_contact_id TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status    TEXT        NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced', 'pending', 'error')),
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_ghl_sync_institution_id ON public.crm_ghl_sync(institution_id);
CREATE INDEX IF NOT EXISTS idx_crm_ghl_sync_ghl_contact_id        ON public.crm_ghl_sync(ghl_contact_id);

-- ─────────────────────────────────────────────────────────────
-- 9. Enable RLS on all new tables
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.crm_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_followups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_broadcasts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ghl_sync          ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 10. RLS Policies
--
-- Access model:
--   admin               → full CRUD on everything
--   pedagogical_manager → full read + write (delete restricted to admin)
--   sales_rep           → own records (crm_owner_id = auth.uid() or created_by = auth.uid())
--   instructor          → read where crm_assigned_instructor_id = auth.uid()
-- ─────────────────────────────────────────────────────────────

-- ── crm_contacts ──────────────────────────────────────────────
CREATE POLICY "crm_contacts_select_policy"
  ON public.crm_contacts FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_contacts.institution_id
        AND (ei.crm_owner_id = auth.uid() OR ei.crm_assigned_instructor_id = auth.uid())
    )
  );

CREATE POLICY "crm_contacts_insert_policy"
  ON public.crm_contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_contacts_update_policy"
  ON public.crm_contacts FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_contacts.institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_contacts_delete_policy"
  ON public.crm_contacts FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── crm_opportunities ─────────────────────────────────────────
CREATE POLICY "crm_opportunities_select_policy"
  ON public.crm_opportunities FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_opportunities.institution_id
        AND (ei.crm_owner_id = auth.uid() OR ei.crm_assigned_instructor_id = auth.uid())
    )
  );

CREATE POLICY "crm_opportunities_insert_policy"
  ON public.crm_opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_opportunities_update_policy"
  ON public.crm_opportunities FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_opportunities.institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_opportunities_delete_policy"
  ON public.crm_opportunities FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── crm_activities ────────────────────────────────────────────
CREATE POLICY "crm_activities_select_policy"
  ON public.crm_activities FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_activities.institution_id
        AND (ei.crm_owner_id = auth.uid() OR ei.crm_assigned_instructor_id = auth.uid())
    )
  );

CREATE POLICY "crm_activities_insert_policy"
  ON public.crm_activities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR user_id = auth.uid()
  );

CREATE POLICY "crm_activities_update_policy"
  ON public.crm_activities FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR user_id = auth.uid()
  );

CREATE POLICY "crm_activities_delete_policy"
  ON public.crm_activities FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() = 'admin'
    OR user_id = auth.uid()
  );

-- ── crm_followups ─────────────────────────────────────────────
CREATE POLICY "crm_followups_select_policy"
  ON public.crm_followups FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = crm_followups.institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_followups_insert_policy"
  ON public.crm_followups FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.educational_institutions ei
      WHERE ei.id = institution_id AND ei.crm_owner_id = auth.uid()
    )
  );

CREATE POLICY "crm_followups_update_policy"
  ON public.crm_followups FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "crm_followups_delete_policy"
  ON public.crm_followups FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() = 'admin'
    OR assigned_to = auth.uid()
  );

-- ── crm_message_templates ─────────────────────────────────────
-- All authenticated users can read templates (needed when sending messages)
CREATE POLICY "crm_message_templates_select_policy"
  ON public.crm_message_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "crm_message_templates_insert_policy"
  ON public.crm_message_templates FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

CREATE POLICY "crm_message_templates_update_policy"
  ON public.crm_message_templates FOR UPDATE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

CREATE POLICY "crm_message_templates_delete_policy"
  ON public.crm_message_templates FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── crm_broadcasts ────────────────────────────────────────────
CREATE POLICY "crm_broadcasts_select_policy"
  ON public.crm_broadcasts FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
  );

CREATE POLICY "crm_broadcasts_insert_policy"
  ON public.crm_broadcasts FOR INSERT TO authenticated
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
  );

CREATE POLICY "crm_broadcasts_update_policy"
  ON public.crm_broadcasts FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'pedagogical_manager')
    OR created_by = auth.uid()
  );

CREATE POLICY "crm_broadcasts_delete_policy"
  ON public.crm_broadcasts FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ── crm_ghl_sync ──────────────────────────────────────────────
-- Reads: admin + PM. Writes: admin only (or service_role from edge functions).
CREATE POLICY "crm_ghl_sync_select_policy"
  ON public.crm_ghl_sync FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'pedagogical_manager'));

CREATE POLICY "crm_ghl_sync_write_policy"
  ON public.crm_ghl_sync FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
