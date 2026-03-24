
-- =============================================
-- PERFORMANCE INDEXES FOR ALL TABLES
-- =============================================

-- quizzes: most queried table - by org, date, status, location
CREATE INDEX IF NOT EXISTS idx_quizzes_org_date ON public.quizzes (organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_org_status ON public.quizzes (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quizzes_org_location_id ON public.quizzes (org_location_id) WHERE org_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_league_id ON public.quizzes (league_id) WHERE league_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_share_token ON public.quizzes (share_token) WHERE share_token IS NOT NULL;

-- quiz_teams: heavily joined with quizzes and teams
CREATE INDEX IF NOT EXISTS idx_quiz_teams_quiz_id ON public.quiz_teams (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_teams_team_id ON public.quiz_teams (team_id);
CREATE INDEX IF NOT EXISTS idx_quiz_teams_org_id ON public.quiz_teams (organization_id);
CREATE INDEX IF NOT EXISTS idx_quiz_teams_quiz_rank ON public.quiz_teams (quiz_id, rank) WHERE rank IS NOT NULL;

-- scores: frequently queried per quiz, team, category
CREATE INDEX IF NOT EXISTS idx_scores_quiz_id ON public.scores (quiz_id);
CREATE INDEX IF NOT EXISTS idx_scores_quiz_team_id ON public.scores (quiz_team_id);
CREATE INDEX IF NOT EXISTS idx_scores_quiz_category_id ON public.scores (quiz_category_id);
CREATE INDEX IF NOT EXISTS idx_scores_org_id ON public.scores (organization_id);

-- quiz_categories: joined with quizzes and categories
CREATE INDEX IF NOT EXISTS idx_quiz_categories_quiz_id ON public.quiz_categories (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_categories_category_id ON public.quiz_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_quiz_categories_org_id ON public.quiz_categories (organization_id);

-- quiz_questions: joined with quizzes, questions, categories
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_org_id ON public.quiz_questions (organization_id);

-- teams: filtered by org and soft-delete
CREATE INDEX IF NOT EXISTS idx_teams_org_active ON public.teams (organization_id) WHERE is_deleted = false;

-- categories: filtered by org and soft-delete
CREATE INDEX IF NOT EXISTS idx_categories_org_active ON public.categories (organization_id) WHERE is_deleted = false;

-- questions: filtered by org and soft-delete
CREATE INDEX IF NOT EXISTS idx_questions_org_active ON public.questions (organization_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_questions_code ON public.questions (organization_id, code);

-- question_categories: join table
CREATE INDEX IF NOT EXISTS idx_question_categories_question_id ON public.question_categories (question_id);
CREATE INDEX IF NOT EXISTS idx_question_categories_category_id ON public.question_categories (category_id);

-- answers: queried by question
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers (question_id);
CREATE INDEX IF NOT EXISTS idx_answers_org_id ON public.answers (organization_id);

-- matching_pairs: queried by question
CREATE INDEX IF NOT EXISTS idx_matching_pairs_question_id ON public.matching_pairs (question_id);

-- memberships: critical for RLS checks
CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON public.memberships (user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_role ON public.memberships (organization_id, role);

-- org_locations: filtered by org and active status
CREATE INDEX IF NOT EXISTS idx_org_locations_org_active ON public.org_locations (organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_locations_coords ON public.org_locations (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- location_schedules: queried by location, day, active
CREATE INDEX IF NOT EXISTS idx_location_schedules_location ON public.location_schedules (organization_location_id);
CREATE INDEX IF NOT EXISTS idx_location_schedules_org ON public.location_schedules (organization_id);
CREATE INDEX IF NOT EXISTS idx_location_schedules_day ON public.location_schedules (day_of_week) WHERE schedule_type = 'recurring' AND is_active = true;

-- leagues: filtered by org
CREATE INDEX IF NOT EXISTS idx_leagues_org ON public.leagues (organization_id);

-- profiles: looked up by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- pending_invites: looked up by email and org
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON public.pending_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_pending_invites_org ON public.pending_invites (organization_id);

-- team_aliases: queried by team
CREATE INDEX IF NOT EXISTS idx_team_aliases_team_id ON public.team_aliases (team_id);
CREATE INDEX IF NOT EXISTS idx_team_aliases_org ON public.team_aliases (organization_id);

-- category_bonuses: queried per quiz/team
CREATE INDEX IF NOT EXISTS idx_category_bonuses_quiz ON public.category_bonuses (quiz_id);
CREATE INDEX IF NOT EXISTS idx_category_bonuses_team ON public.category_bonuses (quiz_team_id);

-- help_types: by org
CREATE INDEX IF NOT EXISTS idx_help_types_org ON public.help_types (organization_id);

-- help_usages: by quiz/team
CREATE INDEX IF NOT EXISTS idx_help_usages_quiz ON public.help_usages (quiz_id);
CREATE INDEX IF NOT EXISTS idx_help_usages_team ON public.help_usages (quiz_team_id);

-- email tables
CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log (recipient_email);
CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails (email);
CREATE INDEX IF NOT EXISTS idx_email_unsub_tokens_token ON public.email_unsubscribe_tokens (token);

-- webhook_events: dedup by event_id
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events (event_id);

-- gift_codes: lookup by code
CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes (code);

-- organizations: slug lookup
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_public_map ON public.organizations (id) WHERE public_map_enabled = true AND is_deleted = false;
