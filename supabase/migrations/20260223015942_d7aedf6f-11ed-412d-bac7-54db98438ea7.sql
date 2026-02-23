
-- Table for pending invites (for users not yet registered)
CREATE TABLE public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'user',
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one invite per email per org
ALTER TABLE public.pending_invites ADD CONSTRAINT unique_invite_per_org UNIQUE (email, organization_id);

-- Enable RLS
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- Only admin+ can manage invites in their org
CREATE POLICY "Admin+ can insert invites" ON public.pending_invites
  FOR INSERT TO authenticated
  WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can view invites" ON public.pending_invites
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can delete invites" ON public.pending_invites
  FOR DELETE TO authenticated
  USING (is_org_admin_or_owner(auth.uid(), organization_id));

-- Update handle_new_user to also process pending invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'sr')
  );

  -- Process pending invites for this email
  INSERT INTO public.memberships (user_id, organization_id, role, invited_by)
  SELECT NEW.id, pi.organization_id, pi.role, pi.invited_by
  FROM public.pending_invites pi
  WHERE LOWER(pi.email) = LOWER(NEW.email)
  ON CONFLICT DO NOTHING;

  -- Clean up processed invites
  DELETE FROM public.pending_invites WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$;
