
-- ============================================
-- 1. ROLE ENUM
-- ============================================
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'user');
CREATE TYPE public.quiz_status AS ENUM ('draft', 'live', 'finished');

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_language TEXT DEFAULT 'sr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. ORGANIZATIONS
-- ============================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  branding_color TEXT DEFAULT '#d97706',
  default_categories_count INT DEFAULT 6,
  default_questions_per_category INT DEFAULT 10,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. MEMBERSHIPS
-- ============================================
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- ============================================
-- 5. TEAMS
-- ============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. TEAM ALIASES
-- ============================================
CREATE TABLE public.team_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 7. CATEGORIES
-- ============================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 8. LEAGUES
-- ============================================
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  season TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 9. HELP TYPES
-- ============================================
CREATE TABLE public.help_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'marker',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 10. QUIZZES
-- ============================================
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id),
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  status quiz_status NOT NULL DEFAULT 'draft',
  override_categories_count INT,
  override_questions_per_category INT,
  share_token TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 11. QUIZ TEAMS (which teams participate in a quiz)
-- ============================================
CREATE TABLE public.quiz_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alias TEXT,
  total_points NUMERIC DEFAULT 0,
  rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, team_id)
);

-- ============================================
-- 12. QUIZ CATEGORIES (which categories in a quiz)
-- ============================================
CREATE TABLE public.quiz_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, category_id)
);

-- ============================================
-- 13. SCORES (per team per category in a quiz)
-- ============================================
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_team_id UUID NOT NULL REFERENCES public.quiz_teams(id) ON DELETE CASCADE,
  quiz_category_id UUID NOT NULL REFERENCES public.quiz_categories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  points NUMERIC NOT NULL DEFAULT 0,
  bonus_points NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_team_id, quiz_category_id)
);

-- ============================================
-- 14. HELP USAGES
-- ============================================
CREATE TABLE public.help_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_team_id UUID NOT NULL REFERENCES public.quiz_teams(id) ON DELETE CASCADE,
  quiz_category_id UUID NOT NULL REFERENCES public.quiz_categories(id) ON DELETE CASCADE,
  help_type_id UUID NOT NULL REFERENCES public.help_types(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_team_id, help_type_id, quiz_id)
);

-- ============================================
-- 15. INDEXES
-- ============================================
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_org ON public.memberships(organization_id);
CREATE INDEX idx_teams_org ON public.teams(organization_id);
CREATE INDEX idx_categories_org ON public.categories(organization_id);
CREATE INDEX idx_quizzes_org ON public.quizzes(organization_id);
CREATE INDEX idx_quizzes_league ON public.quizzes(league_id);
CREATE INDEX idx_scores_quiz ON public.scores(quiz_id);
CREATE INDEX idx_quiz_teams_quiz ON public.quiz_teams(quiz_id);
CREATE INDEX idx_help_usages_quiz ON public.help_usages(quiz_id);

-- ============================================
-- 16. SECURITY DEFINER HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id UUID, _org_id UUID)
RETURNS org_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.memberships
  WHERE user_id = _user_id AND organization_id = _org_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'owner'
  )
$$;

-- ============================================
-- 17. ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_usages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 18. RLS POLICIES - PROFILES
-- ============================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 19. RLS POLICIES - ORGANIZATIONS
-- ============================================
CREATE POLICY "Members can view their orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owner can update org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), id));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- 20. RLS POLICIES - MEMBERSHIPS
-- ============================================
CREATE POLICY "Members can view org memberships"
  ON public.memberships FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owner/Admin can insert memberships"
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
    AND role <> 'owner'
    AND auth.uid() <> user_id
  );

CREATE POLICY "Owner can update memberships"
  ON public.memberships FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete memberships"
  ON public.memberships FOR DELETE TO authenticated
  USING (
    public.is_org_owner(auth.uid(), organization_id)
    AND role <> 'owner'
  );

-- ============================================
-- 21. RLS POLICIES - ORG-SCOPED DATA TABLES
-- (teams, categories, leagues, help_types, quizzes)
-- ============================================

-- TEAMS
CREATE POLICY "Members can view teams"
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage teams"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update teams"
  ON public.teams FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete teams"
  ON public.teams FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- TEAM ALIASES
CREATE POLICY "Members can view aliases"
  ON public.team_aliases FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage aliases"
  ON public.team_aliases FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update aliases"
  ON public.team_aliases FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete aliases"
  ON public.team_aliases FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- CATEGORIES
CREATE POLICY "Members can view categories"
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- LEAGUES
CREATE POLICY "Members can view leagues"
  ON public.leagues FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage leagues"
  ON public.leagues FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update leagues"
  ON public.leagues FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete leagues"
  ON public.leagues FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- HELP TYPES
CREATE POLICY "Members can view help types"
  ON public.help_types FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage help types"
  ON public.help_types FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update help types"
  ON public.help_types FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete help types"
  ON public.help_types FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- QUIZZES
CREATE POLICY "Members can view quizzes"
  ON public.quizzes FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can create quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update quizzes"
  ON public.quizzes FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete quizzes"
  ON public.quizzes FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- QUIZ TEAMS
CREATE POLICY "Members can view quiz teams"
  ON public.quiz_teams FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage quiz teams"
  ON public.quiz_teams FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update quiz teams"
  ON public.quiz_teams FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete quiz teams"
  ON public.quiz_teams FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- QUIZ CATEGORIES
CREATE POLICY "Members can view quiz categories"
  ON public.quiz_categories FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage quiz categories"
  ON public.quiz_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update quiz categories"
  ON public.quiz_categories FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete quiz categories"
  ON public.quiz_categories FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- SCORES
CREATE POLICY "Members can view scores"
  ON public.scores FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can insert scores"
  ON public.scores FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update scores"
  ON public.scores FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete scores"
  ON public.scores FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- HELP USAGES
CREATE POLICY "Members can view help usages"
  ON public.help_usages FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admin+ can manage help usages"
  ON public.help_usages FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update help usages"
  ON public.help_usages FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Owner can delete help usages"
  ON public.help_usages FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

-- ============================================
-- 22. TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'sr')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 23. ADMIN CAP ENFORCEMENT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_admin_cap()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INT;
BEGIN
  IF NEW.role IN ('owner', 'admin') THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.memberships
    WHERE organization_id = NEW.organization_id
      AND role IN ('owner', 'admin')
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF admin_count >= 3 THEN
      RAISE EXCEPTION 'Maximum of 3 admin-level accounts (1 Owner + 2 Admins) per organization';
    END IF;
  END IF;

  -- Enforce exactly 1 owner
  IF NEW.role = 'owner' THEN
    IF EXISTS (
      SELECT 1 FROM public.memberships
      WHERE organization_id = NEW.organization_id
        AND role = 'owner'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Organization can have only one owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_cap_on_membership
  BEFORE INSERT OR UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_cap();

-- ============================================
-- 24. OWNER SELF-INSERT POLICY (for org creation flow)
-- ============================================
CREATE POLICY "User can create own owner membership"
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships WHERE organization_id = memberships.organization_id AND role = 'owner'
    )
  );
