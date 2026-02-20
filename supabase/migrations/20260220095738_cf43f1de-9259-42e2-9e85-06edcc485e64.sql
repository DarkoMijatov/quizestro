
-- Grant table permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_usages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scores TO authenticated;
