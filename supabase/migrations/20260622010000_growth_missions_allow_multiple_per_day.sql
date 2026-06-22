-- =============================================================
-- GROWTH COPILOT — allow multiple missions per day
-- Date: 2026-06-22
-- Additive change: drop the one-mission-per-day UNIQUE constraint so the
-- user can generate additional growth missions on the same day.
-- The idx_gmr_run_date index remains for fast "today's missions" queries.
-- =============================================================

ALTER TABLE public.growth_mission_runs
  DROP CONSTRAINT IF EXISTS growth_mission_runs_run_date_key;
