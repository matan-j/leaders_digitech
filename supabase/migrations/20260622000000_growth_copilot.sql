-- =============================================================
-- GROWTH COPILOT — MVP Schema Migration
-- Date: 2026-06-22
-- Additive only. No existing columns modified or dropped.
--
-- Adds the minimal persistent state for the AI Chief of Staff:
--   1. ceo_goals           — strategic goals with measurable gap (target - current)
--   2. ai_preferences      — the AI's operating system (rules/preferences per entity)
--   3. growth_mission_runs — one AI-generated daily mission + structured inputs + outcome
--
-- Execution itself reuses the existing public.tasks table (no second task engine).
-- RLS uses the existing public.get_current_user_role() helper.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ceo_goals — strategic priorities with measurable gap
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ceo_goals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity             TEXT        NOT NULL DEFAULT 'Digitech',   -- e.g. 'Creators', 'Digitech'
  period_type        TEXT        NOT NULL CHECK (period_type IN ('monthly','weekly')),
  period_start       DATE        NOT NULL,
  period_end         DATE        NOT NULL,
  goal_type          TEXT        NOT NULL,        -- e.g. 'new_schools','organizations','peak_days','newsletters'
  target_value       NUMERIC     NOT NULL,        -- e.g. 15
  current_value      NUMERIC     NOT NULL DEFAULT 0,  -- e.g. 8  →  gap = target_value - current_value
  priority           INTEGER     NOT NULL DEFAULT 1,
  success_definition TEXT,                         -- e.g. '15 meetings booked'
  notes              TEXT,
  status             TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','done','archived')),
  created_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_goals_entity      ON public.ceo_goals(entity);
CREATE INDEX IF NOT EXISTS idx_ceo_goals_status      ON public.ceo_goals(status);
CREATE INDEX IF NOT EXISTS idx_ceo_goals_period      ON public.ceo_goals(period_type, period_start, period_end);

-- ─────────────────────────────────────────────────────────────
-- 2. ai_preferences — how the Copilot thinks (per entity).
--    Editable strategy WITHOUT touching prompts/code.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_preferences (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity           TEXT        NOT NULL UNIQUE DEFAULT 'Digitech',
  rules_json       JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- hard rule toggles (override rules.ts defaults)
  preferences_json JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- soft style/strategy knobs
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. growth_mission_runs — one AI mission/day (BI layer over tasks)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.growth_mission_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date         DATE        NOT NULL UNIQUE,               -- idempotency: one mission/day
  entity           TEXT        NOT NULL DEFAULT 'Digitech',
  goal_id          UUID        REFERENCES public.ceo_goals(id) ON DELETE SET NULL,
  task_id          UUID        REFERENCES public.tasks(id)    ON DELETE SET NULL,  -- execution unit
  mission_title    TEXT        NOT NULL,
  why_it_matters   TEXT,    -- 1. למה זה חשוב
  what_to_do       TEXT,    -- 2. מה עושים עכשיו
  how_to_do_it     TEXT,    -- 3. איך עושים את זה
  ready_message    TEXT,    -- 4. הודעה מוכנה
  system_update    TEXT,    -- 5. מה לעדכן במערכת
  success_criteria TEXT,    -- 6. מה נחשב הצלחה
  impact_score     INTEGER     CHECK (impact_score BETWEEN 1 AND 10),  -- prefer high-leverage
  -- structured inputs (auditability / debugging / analytics)
  input_goals          JSONB,
  input_leads          JSONB,
  input_opportunities  JSONB,
  input_tasks          JSONB,
  input_organizations  JSONB,
  status           TEXT        NOT NULL DEFAULT 'generated'
                   CHECK (status IN ('generated','started','blocked','needs_followup','done')),
  outcome_notes    TEXT,
  eod_report       TEXT,    -- AI end-of-day summary (5-question format)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmr_run_date ON public.growth_mission_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_gmr_status   ON public.growth_mission_runs(status);
CREATE INDEX IF NOT EXISTS idx_gmr_entity   ON public.growth_mission_runs(entity);

-- ─────────────────────────────────────────────────────────────
-- 4. Enable RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ceo_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_mission_runs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS Policies
--   admin            → full CRUD
--   pedagogical_mgr  → read only
--   (edge function uses SERVICE_ROLE_KEY → bypasses RLS for writes)
-- ─────────────────────────────────────────────────────────────

-- ── ceo_goals ────────────────────────────────────────────────
DROP POLICY IF EXISTS ceo_goals_select ON public.ceo_goals;
CREATE POLICY ceo_goals_select ON public.ceo_goals FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager'));

DROP POLICY IF EXISTS ceo_goals_write ON public.ceo_goals;
CREATE POLICY ceo_goals_write ON public.ceo_goals FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ── ai_preferences ───────────────────────────────────────────
DROP POLICY IF EXISTS ai_prefs_select ON public.ai_preferences;
CREATE POLICY ai_prefs_select ON public.ai_preferences FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager'));

DROP POLICY IF EXISTS ai_prefs_write ON public.ai_preferences;
CREATE POLICY ai_prefs_write ON public.ai_preferences FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ── growth_mission_runs ──────────────────────────────────────
DROP POLICY IF EXISTS gmr_select ON public.growth_mission_runs;
CREATE POLICY gmr_select ON public.growth_mission_runs FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin','pedagogical_manager'));

DROP POLICY IF EXISTS gmr_write ON public.growth_mission_runs;
CREATE POLICY gmr_write ON public.growth_mission_runs FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- 6. updated_at triggers (reuse existing public.set_updated_at())
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ceo_goals_updated_at ON public.ceo_goals;
CREATE TRIGGER trg_ceo_goals_updated_at
  BEFORE UPDATE ON public.ceo_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_preferences_updated_at ON public.ai_preferences;
CREATE TRIGGER trg_ai_preferences_updated_at
  BEFORE UPDATE ON public.ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_growth_mission_runs_updated_at ON public.growth_mission_runs;
CREATE TRIGGER trg_growth_mission_runs_updated_at
  BEFORE UPDATE ON public.growth_mission_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. Seed default AI operating-system rows (idempotent)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.ai_preferences (entity, rules_json, preferences_json)
VALUES
  ('Digitech', '{}'::jsonb, '{"sales_first":true,"one_strategic_action_per_day":true,"prefer_existing_clients":true,"prefer_warm_leads":true,"explain_simply":true,"avoid_busy_work":true,"max_recommendations":2}'::jsonb),
  ('Creators', '{}'::jsonb, '{"sales_first":true,"one_strategic_action_per_day":true,"prefer_existing_clients":true,"prefer_warm_leads":true,"explain_simply":true,"avoid_busy_work":true,"max_recommendations":2}'::jsonb)
ON CONFLICT (entity) DO NOTHING;
