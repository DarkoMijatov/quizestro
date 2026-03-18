
-- Add public_map_enabled to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS public_map_enabled boolean NOT NULL DEFAULT false;

-- Organization locations
CREATE TABLE public.org_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_name text NOT NULL,
  address_line text,
  city text NOT NULL,
  postal_code text,
  country text NOT NULL DEFAULT 'Serbia',
  latitude double precision,
  longitude double precision,
  description text,
  contact_email text,
  contact_phone text,
  reservation_url text,
  website_url text,
  instagram_url text,
  facebook_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org_locations" ON public.org_locations FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert org_locations" ON public.org_locations FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update org_locations" ON public.org_locations FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete org_locations" ON public.org_locations FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Public read policy: anyone can see active locations of visible orgs
CREATE POLICY "Public can view active locations of visible orgs" ON public.org_locations FOR SELECT TO anon USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.public_map_enabled = true AND o.is_deleted = false
  )
);

-- Location schedules
CREATE TABLE public.location_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_location_id uuid NOT NULL REFERENCES public.org_locations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  schedule_type text NOT NULL DEFAULT 'recurring' CHECK (schedule_type IN ('recurring', 'one_time')),
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  event_date date,
  start_time time NOT NULL,
  end_time time,
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  title text,
  category text,
  language text,
  entry_fee text,
  prize_info text,
  team_size_info text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view location_schedules" ON public.location_schedules FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert location_schedules" ON public.location_schedules FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update location_schedules" ON public.location_schedules FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete location_schedules" ON public.location_schedules FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Public read policy for schedules
CREATE POLICY "Public can view active schedules of visible orgs" ON public.location_schedules FOR SELECT TO anon USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.org_locations ol
    JOIN public.organizations o ON o.id = ol.organization_id
    WHERE ol.id = organization_location_id AND ol.is_active = true AND o.public_map_enabled = true AND o.is_deleted = false
  )
);
