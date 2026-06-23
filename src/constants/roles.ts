/**
 * Role constants for Leader App.
 *
 * Phase Modularity Level 1A (V6): created as a centralized source of truth.
 * NOT yet wired into existing role checks — existing string literals across
 * the codebase (e.g. `=== 'admin'`, `.includes('sales_rep')`) are intentionally
 * left as-is and will be migrated in a future Level (1B / 2).
 *
 * Aligned with the DB `user_role` enum (see supabase/types.ts):
 *   "instructor" | "pedagogical_manager" | "admin" | "sales_rep"
 */

export const ROLE_ADMIN = 'admin' as const;
export const ROLE_PEDAGOGICAL_MANAGER = 'pedagogical_manager' as const;
export const ROLE_INSTRUCTOR = 'instructor' as const;
export const ROLE_SALES_REP = 'sales_rep' as const;

export type AppRole =
  | typeof ROLE_ADMIN
  | typeof ROLE_PEDAGOGICAL_MANAGER
  | typeof ROLE_INSTRUCTOR
  | typeof ROLE_SALES_REP;

/** Users who can manage system settings, content, and reports. */
export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_PEDAGOGICAL_MANAGER] as const;

/** Users who can access CRM features (leads, pipeline, contacts). */
export const CRM_ROLES = [ROLE_ADMIN, ROLE_SALES_REP] as const;
