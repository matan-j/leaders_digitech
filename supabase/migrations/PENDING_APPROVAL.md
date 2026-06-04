# Pending Migrations — Manual Approval Required

> **Created during Phase Modularity Level 1A (V6).**
> **Do NOT run on production until Matan explicitly approves each one.**

The migrations listed here are committed to the branch
`phase-modularity-level-1a-safe-config` but have **not** been executed on
the Supabase production project (`icwidsqbydgycuedhznc`) or on any staging
environment. They are intentionally held back so that Matan can review the
exact SQL before any data-shape change.

## Files awaiting approval

| Migration | Purpose | Risk | Notes |
|---|---|---|---|
| `20260604120001_extend_system_defaults.sql` | Add 3 nullable columns to `system_defaults` (`instructor_cost_per_lesson`, `revenue_per_lesson`, `low_attendance_threshold`). | **Very low** — additive, nullable, no defaults, no code reads them yet. | Frontend wiring deferred to a future Level. |
| `20260604120002_create_platform_audit_log.sql` | Create `platform_audit_log` table + `log_platform_action()` SECURITY DEFINER function. | **Low** — new table, no existing code writes to it. | Read access restricted to `admin`. |
| `20260604120003_protect_profiles_role_update.sql` | Add `BEFORE UPDATE` trigger on `profiles` that blocks non-admins from changing the `role` column. | **Medium** — affects an existing, busy table. | Admins keep full access. Self-role-escalation becomes impossible for non-admins. |

## Manual approval workflow

1. Review the SQL by reading each file in this directory.
2. On a **local Supabase instance** or staging clone, run:
   ```bash
   supabase db reset       # local only
   # or, against staging:
   supabase db push --linked
   ```
3. Verify that:
   - All three migrations apply cleanly without errors.
   - `system_defaults` gains 3 nullable columns.
   - `platform_audit_log` table exists with the documented RLS policy.
   - `prevent_self_role_escalation_trigger` is attached to `profiles`.
4. Manually validate the role-escalation block by attempting (as a non-admin
   user via SQL editor or RPC):
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
   ```
   This should fail with `Permission denied: only admin users may change profiles.role`.
5. Only after **Matan's explicit go-ahead** (per migration), apply against
   production by linking the prod project and running:
   ```bash
   supabase link --project-ref icwidsqbydgycuedhznc
   supabase db push
   ```

## Rollback (if production application fails)

Each migration is independent and reversible:

- `20260604120001` → `ALTER TABLE system_defaults DROP COLUMN instructor_cost_per_lesson, DROP COLUMN revenue_per_lesson, DROP COLUMN low_attendance_threshold;`
- `20260604120002` → `DROP FUNCTION log_platform_action; DROP TABLE platform_audit_log;`
- `20260604120003` → `DROP TRIGGER prevent_self_role_escalation_trigger ON profiles; DROP FUNCTION prevent_self_role_escalation;`

## Phase Modularity Level 1A — Scope Reminder

This file documents the only migration work performed during Level 1A. **No
other DB changes were planned or executed.** In particular:

- ❌ No `organizations` table
- ❌ No feature flag tables (the existing `system_defaults.rewards_page_enabled` predates V6)
- ❌ No RLS hardening migrations (the `USING (true)` policies surveyed in
  `docs/rls-audit-report.md` are intentionally left untouched)
- ❌ No backfill of `profiles.role` from `auth.users.user_metadata`
