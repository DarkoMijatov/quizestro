-- Allow authenticated users to INSERT organizations
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (true);

-- Members can view their organizations
CREATE POLICY "Members can view organizations"
ON public.organizations FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), id));

-- Owner can update their organization
CREATE POLICY "Owner can update organization"
ON public.organizations FOR UPDATE TO authenticated
USING (is_org_owner(auth.uid(), id));

-- Owner can delete their organization
CREATE POLICY "Owner can delete organization"
ON public.organizations FOR DELETE TO authenticated
USING (is_org_owner(auth.uid(), id));