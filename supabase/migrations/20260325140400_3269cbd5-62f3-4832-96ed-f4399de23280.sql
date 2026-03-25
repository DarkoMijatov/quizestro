
-- Add scoring_mode to quizzes
ALTER TABLE public.quizzes ADD COLUMN scoring_mode text NOT NULL DEFAULT 'per_category';

-- Quiz parts table (named sections like "Prvo poluvreme", "Muzička runda")
CREATE TABLE public.quiz_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  part_number integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, part_number)
);

ALTER TABLE public.quiz_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view quiz_parts" ON public.quiz_parts FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert quiz_parts" ON public.quiz_parts FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update quiz_parts" ON public.quiz_parts FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete quiz_parts" ON public.quiz_parts FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Part scores table (total scores per part per team)
CREATE TABLE public.part_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_part_id uuid NOT NULL REFERENCES public.quiz_parts(id) ON DELETE CASCADE,
  quiz_team_id uuid NOT NULL REFERENCES public.quiz_teams(id) ON DELETE CASCADE,
  points numeric NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_part_id, quiz_team_id)
);

ALTER TABLE public.part_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view part_scores" ON public.part_scores FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert part_scores" ON public.part_scores FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update part_scores" ON public.part_scores FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete part_scores" ON public.part_scores FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));
