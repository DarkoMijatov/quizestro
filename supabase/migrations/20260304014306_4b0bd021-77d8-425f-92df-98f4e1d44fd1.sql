
-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Members can view their own organizations
CREATE POLICY "Members can view organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (is_org_member(auth.uid(), id));

-- Owner can update their organization
CREATE POLICY "Owner can update organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (is_org_owner(auth.uid(), id));

-- Authenticated users can create organizations (for onboarding)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Owner can delete (soft-delete) organization
CREATE POLICY "Owner can delete organization"
ON public.organizations FOR DELETE
TO authenticated
USING (is_org_owner(auth.uid(), id));

-- Allow service role full access (for webhooks/edge functions)
-- Service role bypasses RLS by default, so no policy needed
