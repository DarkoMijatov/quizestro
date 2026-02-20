
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix memberships self-insert policy too
DROP POLICY IF EXISTS "User can create own owner membership" ON public.memberships;
CREATE POLICY "User can create own owner membership"
  ON public.memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND (role = 'owner'::org_role)
    AND (NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
        AND m.role = 'owner'::org_role
    ))
  );

-- Fix organizations SELECT
DROP POLICY IF EXISTS "Members can view their orgs" ON public.organizations;
CREATE POLICY "Members can view their orgs"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), id));

-- Fix organizations UPDATE
DROP POLICY IF EXISTS "Owner can update org" ON public.organizations;
CREATE POLICY "Owner can update org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (is_org_owner(auth.uid(), id));

-- Fix memberships SELECT
DROP POLICY IF EXISTS "Members can view org memberships" ON public.memberships;
CREATE POLICY "Members can view org memberships"
  ON public.memberships FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- Fix memberships INSERT for admin/owner
DROP POLICY IF EXISTS "Owner/Admin can insert memberships" ON public.memberships;
CREATE POLICY "Owner/Admin can insert memberships"
  ON public.memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_admin_or_owner(auth.uid(), organization_id)
    AND role <> 'owner'::org_role
    AND auth.uid() <> user_id
  );

-- Fix memberships UPDATE
DROP POLICY IF EXISTS "Owner can update memberships" ON public.memberships;
CREATE POLICY "Owner can update memberships"
  ON public.memberships FOR UPDATE
  TO authenticated
  USING (is_org_owner(auth.uid(), organization_id));

-- Fix memberships DELETE
DROP POLICY IF EXISTS "Owner can delete memberships" ON public.memberships;
CREATE POLICY "Owner can delete memberships"
  ON public.memberships FOR DELETE
  TO authenticated
  USING (is_org_owner(auth.uid(), organization_id) AND role <> 'owner'::org_role);

-- Fix help_types policies
DROP POLICY IF EXISTS "Members can view help types" ON public.help_types;
CREATE POLICY "Members can view help types" ON public.help_types FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admin+ can manage help types" ON public.help_types;
CREATE POLICY "Admin+ can manage help types" ON public.help_types FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admin+ can update help types" ON public.help_types;
CREATE POLICY "Admin+ can update help types" ON public.help_types FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Owner can delete help types" ON public.help_types;
CREATE POLICY "Owner can delete help types" ON public.help_types FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fix all other tables similarly
DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
CREATE POLICY "Members can view categories" ON public.categories FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage categories" ON public.categories;
CREATE POLICY "Admin+ can manage categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update categories" ON public.categories;
CREATE POLICY "Admin+ can update categories" ON public.categories FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete categories" ON public.categories;
CREATE POLICY "Owner can delete categories" ON public.categories FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view teams" ON public.teams;
CREATE POLICY "Members can view teams" ON public.teams FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage teams" ON public.teams;
CREATE POLICY "Admin+ can manage teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update teams" ON public.teams;
CREATE POLICY "Admin+ can update teams" ON public.teams FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete teams" ON public.teams;
CREATE POLICY "Owner can delete teams" ON public.teams FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view aliases" ON public.team_aliases;
CREATE POLICY "Members can view aliases" ON public.team_aliases FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage aliases" ON public.team_aliases;
CREATE POLICY "Admin+ can manage aliases" ON public.team_aliases FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update aliases" ON public.team_aliases;
CREATE POLICY "Admin+ can update aliases" ON public.team_aliases FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete aliases" ON public.team_aliases;
CREATE POLICY "Owner can delete aliases" ON public.team_aliases FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view leagues" ON public.leagues;
CREATE POLICY "Members can view leagues" ON public.leagues FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage leagues" ON public.leagues;
CREATE POLICY "Admin+ can manage leagues" ON public.leagues FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update leagues" ON public.leagues;
CREATE POLICY "Admin+ can update leagues" ON public.leagues FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete leagues" ON public.leagues;
CREATE POLICY "Owner can delete leagues" ON public.leagues FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view quizzes" ON public.quizzes;
CREATE POLICY "Members can view quizzes" ON public.quizzes FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can create quizzes" ON public.quizzes;
CREATE POLICY "Admin+ can create quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update quizzes" ON public.quizzes;
CREATE POLICY "Admin+ can update quizzes" ON public.quizzes FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete quizzes" ON public.quizzes;
CREATE POLICY "Owner can delete quizzes" ON public.quizzes FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view quiz categories" ON public.quiz_categories;
CREATE POLICY "Members can view quiz categories" ON public.quiz_categories FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage quiz categories" ON public.quiz_categories;
CREATE POLICY "Admin+ can manage quiz categories" ON public.quiz_categories FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update quiz categories" ON public.quiz_categories;
CREATE POLICY "Admin+ can update quiz categories" ON public.quiz_categories FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete quiz categories" ON public.quiz_categories;
CREATE POLICY "Owner can delete quiz categories" ON public.quiz_categories FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view quiz teams" ON public.quiz_teams;
CREATE POLICY "Members can view quiz teams" ON public.quiz_teams FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage quiz teams" ON public.quiz_teams;
CREATE POLICY "Admin+ can manage quiz teams" ON public.quiz_teams FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update quiz teams" ON public.quiz_teams;
CREATE POLICY "Admin+ can update quiz teams" ON public.quiz_teams FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete quiz teams" ON public.quiz_teams;
CREATE POLICY "Owner can delete quiz teams" ON public.quiz_teams FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view scores" ON public.scores;
CREATE POLICY "Members can view scores" ON public.scores FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can insert scores" ON public.scores;
CREATE POLICY "Admin+ can insert scores" ON public.scores FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update scores" ON public.scores;
CREATE POLICY "Admin+ can update scores" ON public.scores FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete scores" ON public.scores;
CREATE POLICY "Owner can delete scores" ON public.scores FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Members can view help usages" ON public.help_usages;
CREATE POLICY "Members can view help usages" ON public.help_usages FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can manage help usages" ON public.help_usages;
CREATE POLICY "Admin+ can manage help usages" ON public.help_usages FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Admin+ can update help usages" ON public.help_usages;
CREATE POLICY "Admin+ can update help usages" ON public.help_usages FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Owner can delete help usages" ON public.help_usages;
CREATE POLICY "Owner can delete help usages" ON public.help_usages FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));
