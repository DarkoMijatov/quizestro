
CREATE OR REPLACE FUNCTION public.can_use_pro_features(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id
      AND (
        subscription_tier IN ('premium', 'trial')
        OR (
          premium_override = true
          AND (premium_override_until IS NULL OR premium_override_until > now())
        )
      )
  )
$$;
