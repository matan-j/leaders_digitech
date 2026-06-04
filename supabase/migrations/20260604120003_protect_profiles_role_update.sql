-- Phase Modularity Level 1A (V6) — Safe Config Extraction
--
-- Hardens the existing profiles UPDATE policy to prevent users from
-- escalating their own role.
--
-- Current state (as of main, June 2026):
--   - profiles.role column ALREADY EXISTS (added long before V6).
--   - get_current_user_role() already reads from profiles.role.
--   - Existing UPDATE policy "Users can update their own profile" allows
--     a user to update ANY column on their own row — including `role`.
--
-- This migration adds a BEFORE UPDATE trigger that blocks non-admin users
-- from changing the `role` column on profiles. Admins (verified via
-- get_current_user_role()) retain the ability to change any user's role.
--
-- Why a trigger and not a stricter RLS policy?
--   - RLS WITH CHECK cannot reference OLD row values; you can't express
--     "role didn't change" as a WITH CHECK predicate.
--   - A BEFORE UPDATE trigger has access to both OLD and NEW and can raise
--     a clean exception when self-escalation is attempted.
--
-- NOTE (V6 scope): This migration is FILE-ONLY and MUST NOT be run in
-- production yet. See supabase/migrations/PENDING_APPROVAL.md for the
-- manual approval workflow.

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if role isn't changing.
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow admins to change anyone's role (including their own).
  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Block everyone else from changing the role column.
  RAISE EXCEPTION 'Permission denied: only admin users may change profiles.role (attempted by %, target %)',
    auth.uid(), NEW.id
    USING ERRCODE = '42501'; -- insufficient_privilege
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_self_role_escalation_trigger
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

COMMENT ON FUNCTION public.prevent_self_role_escalation() IS
  'BEFORE UPDATE trigger fn on profiles. Blocks non-admin users from changing profiles.role on any row (including their own). Admins are unrestricted.';
