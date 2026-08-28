DROP POLICY IF EXISTS "Owner can delete help usages" ON public.help_usages;
CREATE POLICY "Admin+ can delete help usages"
ON public.help_usages
FOR DELETE
TO authenticated
USING (public.is_org_admin_or_owner(auth.uid(), organization_id));