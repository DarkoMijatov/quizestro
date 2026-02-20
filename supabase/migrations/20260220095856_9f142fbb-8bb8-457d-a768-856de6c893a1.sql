
-- Drop all existing policies on organizations
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their orgs" ON public.organizations;
DROP POLICY IF EXISTS "Owner can update org" ON public.organizations;

-- Disable RLS entirely
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
