
-- Add subscription/billing fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS premium_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_override_reason text,
  ADD COLUMN IF NOT EXISTS premium_override_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS premium_override_by uuid;

-- Create webhook events log table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  payload jsonb
);

-- RLS on webhook_events - no public access, only service role
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
