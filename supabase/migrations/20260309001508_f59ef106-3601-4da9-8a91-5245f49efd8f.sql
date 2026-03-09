
-- Create owner membership automatically when a new organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If there's no authenticated user context (e.g. service calls), do nothing
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure the creator becomes the org owner (prevents onboarding race where SELECT is blocked)
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
      AND organization_id = NEW.id
  ) THEN
    INSERT INTO public.memberships (user_id, organization_id, role, invited_by)
    VALUES (auth.uid(), NEW.id, 'owner'::public.org_role, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_owner_membership_on_org_insert ON public.organizations;
CREATE TRIGGER create_owner_membership_on_org_insert
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_organization();

-- Lock down direct execution (defense-in-depth; trigger still works)
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_organization() TO authenticated;
