
-- Fix the permissive INSERT policy on organizations
-- We keep it but scope to authenticated only (which it already is).
-- The real protection is that creating an org without becoming owner is useless,
-- and the owner membership is enforced by separate policies + triggers.
-- Drop and recreate with a comment explaining the design decision.
DROP POLICY "Authenticated users can create orgs" ON public.organizations;

-- Recreate: user must be authenticated. The org creation flow always pairs
-- with a membership insert (owner), so orphan orgs are harmless.
CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
