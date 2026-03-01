
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Populate from auth.users for existing profiles
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.user_id;

-- Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, preferred_language, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'sr'),
    NEW.email
  );

  INSERT INTO public.memberships (user_id, organization_id, role, invited_by)
  SELECT NEW.id, pi.organization_id, pi.role, pi.invited_by
  FROM public.pending_invites pi
  WHERE LOWER(pi.email) = LOWER(NEW.email)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.pending_invites WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$function$;
