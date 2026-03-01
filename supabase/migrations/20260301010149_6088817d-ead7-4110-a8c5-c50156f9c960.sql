
-- Gift codes table
CREATE TABLE public.gift_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  duration_days integer NULL, -- NULL = unlimited
  is_used boolean NOT NULL DEFAULT false,
  used_by_org_id uuid REFERENCES public.organizations(id) NULL,
  used_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  note text NULL
);

-- Enable RLS
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can manage gift codes (no public access)
-- Authenticated users can only read codes to validate them via edge function
-- No direct client access policies needed since redemption goes through edge function
