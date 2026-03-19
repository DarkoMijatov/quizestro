CREATE POLICY "Public can view visible organizations"
ON public.organizations
FOR SELECT
TO anon
USING (public_map_enabled = true AND is_deleted = false);