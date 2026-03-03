
-- Add soft-delete column to profiles
ALTER TABLE public.profiles ADD COLUMN is_deactivated boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN deactivated_at timestamp with time zone;

-- Add soft-delete column to organizations
ALTER TABLE public.organizations ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN deleted_at timestamp with time zone;
