
-- Allow org members to view profiles of other members in same org
CREATE POLICY "Org members can view fellow member profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.user_id
  )
);
