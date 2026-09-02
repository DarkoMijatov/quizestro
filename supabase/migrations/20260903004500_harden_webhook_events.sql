ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.webhook_events
  ALTER COLUMN processed_at DROP NOT NULL,
  ALTER COLUMN processed_at DROP DEFAULT;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_last_event_at timestamp with time zone;

UPDATE public.webhook_events
SET processing_status = 'processed',
    processed_at = COALESCE(processed_at, now()),
    updated_at = now()
WHERE processing_status IS NULL OR processing_status = '';

CREATE INDEX IF NOT EXISTS webhook_events_processing_status_idx
  ON public.webhook_events(processing_status);

CREATE INDEX IF NOT EXISTS webhook_events_organization_occurred_at_idx
  ON public.webhook_events(organization_id, occurred_at DESC);
