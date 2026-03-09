
-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: members can view their own orgs
CREATE POLICY "Members can view own organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (is_org_member(auth.uid(), id));

-- INSERT: any authenticated user can create an org (needed for onboarding)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: only org owner can update
CREATE POLICY "Owner can update organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (is_org_owner(auth.uid(), id));

-- DELETE: only org owner can delete
CREATE POLICY "Owner can delete organization"
ON public.organizations
FOR DELETE
TO authenticated
USING (is_org_owner(auth.uid(), id));
