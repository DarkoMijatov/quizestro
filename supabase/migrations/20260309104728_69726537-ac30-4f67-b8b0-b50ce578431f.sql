
-- Category bonus: one per quiz+category, awarded to the winning team
CREATE TABLE public.category_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_category_id uuid NOT NULL REFERENCES public.quiz_categories(id) ON DELETE CASCADE,
  quiz_team_id uuid NOT NULL REFERENCES public.quiz_teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, quiz_category_id) -- only one bonus per category per quiz
);

ALTER TABLE public.category_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin+ can insert category_bonuses" ON public.category_bonuses
  FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can update category_bonuses" ON public.category_bonuses
  FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Admin+ can delete category_bonuses" ON public.category_bonuses
  FOR DELETE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Members can view category_bonuses" ON public.category_bonuses
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
