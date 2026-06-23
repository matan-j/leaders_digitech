# RLS Audit Report — `USING (true)` Policies

> **Generated during Phase Modularity Level 1A (V6).**
> **Read-only audit. No migration is being created to fix these now.**

## Purpose

Each policy below currently grants its operation to **any authenticated
user**, irrespective of role, ownership, or organization. In a Single-Tenant
deployment (Digitech today) this is usually acceptable because every
authenticated user already belongs to the same business. The risk surfaces
the moment a second organization (e.g. GEFEN) is onboarded — every `USING
(true)` policy becomes a cross-tenant data leak.

This report enumerates the policies, classifies the risk, recommends a
future fix, and flags whether changing the policy today would break
existing app behavior.

## Method

```bash
grep -rnE "USING \(\s*true\s*\)" supabase/migrations/
```

11 occurrences across 11 migrations were found.

## Inventory

| # | Migration | Table | Policy Name | Op | Current Risk | Recommended Future Fix | App Break Risk if Changed Now |
|---|---|---|---|---|---|---|---|
| 1 | `20250115000000_course_instance_schedule_refactor.sql:37` | `course_instance_schedules` | `Users can view course_instance_schedules` | SELECT | Low (org-internal data; every authed user already shares one tenant today) | Restrict to `(course_instance.instructor_id = auth.uid()) OR get_current_user_role() IN ('admin','pedagogical_manager') OR (organization_id = get_current_user_organization_id())` in Level 2 | **High** — Calendar.tsx and CourseAssignments.tsx read this for all instructors regardless of who is logged in. Tightening to `auth.uid()` will hide other instructors' schedules from admin/PM views unless the policy also allows them. |
| 2 | `20250709103352-…sql:15` / `20250709103652-…sql:18` / `20250709103805-…sql:21` | `courses` | `Anyone can view courses` / `courses_select_policy` | SELECT | Medium (course catalog is shared business IP that should be tenant-scoped in SaaS) | Restrict to `organization_id = get_current_user_organization_id()` in Level 2 (after `organizations` exists) | **Medium** — `Courses.tsx`, `CourseAssignments.tsx`, and several dialog pickers select all courses. Tenant-scoping is safe today since one tenant exists; same logic survives once `organization_id` is backfilled. |
| 3 | `20251110203726_add_blocked_dates_rls_policy.sql:9` | `blocked_dates` | `Allow authenticated users to read blocked dates` | SELECT | Low (calendar holidays/closures; not sensitive) | Optional: scope to org in Level 2 if calendars become per-tenant | **High** — Calendar code expects every authed user to see all blocked dates. Tightening prematurely will break scheduling logic. Keep as is until org model lands. |
| 4 | `20260418000000_add_crm_module.sql:377` | `crm_message_templates` | `crm_message_templates_select_policy` | SELECT | **Critical** for SaaS — templates may contain customer-specific phrasing, lead names, internal copy | Add `organization_id` + scope SELECT to user's org in Level 2 | **Medium** — `CRMMessagesEditor` and `CRMBroadcast` list all templates. Today (single tenant) the policy is fine; the moment a second tenant joins, their templates leak. |
| 5 | `20260418000001_add_crm_automation_rules.sql:17` | `crm_automation_rules` | `crm_automation_rules_select` | SELECT | **Critical** for SaaS — automation rules can encode pipeline triggers that reveal a customer's process | Add `organization_id` + scope in Level 2 | **Low** — only an admin UI reads them currently; restricting to admin/sales_rep would not visibly impact today. |
| 6 | `20260420000000_add_crm_pipeline_stages.sql:14` | `crm_pipeline_stages` | `crm_pipeline_stages_select` | SELECT | **Critical** for SaaS — stage labels are part of each customer's sales process | Add `organization_id` + scope in Level 2 | **High** — Pipeline UI, stage filters, and broadcast targeting all assume global stages. Tightening prematurely will break the Kanban board. |
| 7 | `20260420000003_add_crm_settings.sql:12` | `crm_settings` | `crm_settings_select` | SELECT | **Critical** for SaaS — `company_info`, `instructor_commission`, `default_vat_rate` are tenant-private | Convert to per-org `organization_settings` table in Level 2 | **Medium** — Quote PDF generator, AdminSettings, and `useDisplayLogo` read this. Migration must repoint reads to the new table. |
| 8 | `20260512000001_create_products_catalog.sql:43` | `products` | `products_read` | SELECT | **High** for SaaS — product catalog with pricing is per-tenant IP | Add `organization_id` + scope in Level 2 | **Medium** — Products.tsx and quote line item dialogs read all products. Single tenant today; tighten with organization model. |
| 9 | `20260512000002_create_quotes.sql:127` | `quote_counters` | `quote_counters_read` | SELECT | Medium — exposes next-quote-number for the year | Convert PK from `(year)` to `(organization_id, year)` and scope SELECT/UPSERT to org in Level 2 | **Low** — only the quote creation flow reads it. |

### Aggregated count by table

| Table | Permissive policies | Notes |
|---|---|---|
| `courses` | 3 (duplicates across legacy migrations) | The latest `courses_select_policy` is authoritative; the older `Anyone can view courses` definitions were superseded by `DROP POLICY IF EXISTS` chains. |
| `course_instance_schedules` | 1 | |
| `blocked_dates` | 1 | |
| `crm_message_templates` | 1 | |
| `crm_automation_rules` | 1 | |
| `crm_pipeline_stages` | 1 | |
| `crm_settings` | 1 | |
| `products` | 1 | |
| `quote_counters` | 1 | |

## Risk Classification Legend

- **Critical** — Holds per-tenant business IP (templates, pipeline stages, settings). The first day a second tenant joins the database, this policy leaks data.
- **High** — Holds business data that should be tenant-scoped but is not obviously customer-visible.
- **Medium** — Holds shared reference data that may need per-tenant variants but is not immediately sensitive.
- **Low** — Holds infrastructural or shared reference data with negligible per-tenant risk.

## Recommendation (deferred to a future Level)

All 9 distinct policies above should be hardened **as part of Phase
Modularity Level 2**, *after* the `organizations` table exists and every
row in the dependent tables has been backfilled with an `organization_id`.
Hardening before that point would either:

1. **Lose access** — if RLS is tightened before reads are repointed, the
   app will see empty result sets for every authenticated user.
2. **Mask the multi-tenant gap** — if RLS is tightened to "any role" or
   "admin only", we hide the data-isolation problem instead of solving it.

Therefore Level 1A intentionally leaves these policies untouched.

## What is NOT in this report

- Policies that already scope by `auth.uid()`, role, or institution
  ownership (the vast majority of CRM tables — `crm_contacts`,
  `crm_opportunities`, `crm_activities`, `crm_followups`,
  `crm_communications`, `crm_broadcasts`, `crm_ghl_sync`, `crm_lists`,
  `crm_list_members`, `crm_unmatched_communications`, `crm_notifications`,
  `crm_contact_statuses`, `crm_broadcast_log`, `quotes`, `quote_lines`,
  `academic_year_orders` + descendants, `instructors`,
  `instructor_assignments`, `projects`, `project_members`, `tasks`,
  `task_comments`, `project_links`, `system_defaults`, `profiles`).
- The new `platform_audit_log` table introduced in V6 (already restricted
  to admin SELECT).
- Edge Function code paths that use `SUPABASE_SERVICE_ROLE_KEY` and bypass
  RLS entirely — those will be audited separately in Level 2's edge
  function review.

## Cross-reference

- Migrations awaiting approval: `supabase/migrations/PENDING_APPROVAL.md`
- Strategic context: `/Users/matanjacobson/.claude/plans/leader-app-quizzical-cook.md` (V6)
