
-- Add code column to categories and quizzes
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS code text;

-- Create question type enum
CREATE TYPE public.question_type AS ENUM ('text', 'multiple_choice', 'matching');

-- Create media type enum
CREATE TYPE public.media_type AS ENUM ('image', 'video', 'audio');

-- Create sequence for global question IDs
CREATE SEQUENCE IF NOT EXISTS public.question_global_id_seq START WITH 1000;

-- Questions table
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  question_text text NOT NULL,
  type public.question_type NOT NULL DEFAULT 'text',
  media_url text,
  media_type public.media_type,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Answers table
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Matching pairs table
CREATE TABLE public.matching_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  left_value text NOT NULL,
  right_value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Question-Category junction
CREATE TABLE public.question_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, category_id)
);

-- Quiz-Question junction
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  question_order integer NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, question_id)
);

-- Trigger for updated_at on questions
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS on all new tables
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Questions RLS
CREATE POLICY "Members can view questions" ON public.questions FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update questions" ON public.questions FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete questions" ON public.questions FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Answers RLS
CREATE POLICY "Members can view answers" ON public.answers FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert answers" ON public.answers FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update answers" ON public.answers FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete answers" ON public.answers FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Matching pairs RLS
CREATE POLICY "Members can view matching_pairs" ON public.matching_pairs FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert matching_pairs" ON public.matching_pairs FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update matching_pairs" ON public.matching_pairs FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Owner can delete matching_pairs" ON public.matching_pairs FOR DELETE TO authenticated USING (is_org_owner(auth.uid(), organization_id));

-- Question categories RLS
CREATE POLICY "Members can view question_categories" ON public.question_categories FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert question_categories" ON public.question_categories FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update question_categories" ON public.question_categories FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can delete question_categories" ON public.question_categories FOR DELETE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));

-- Quiz questions RLS
CREATE POLICY "Members can view quiz_questions" ON public.quiz_questions FOR SELECT TO authenticated USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admin+ can insert quiz_questions" ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can update quiz_questions" ON public.quiz_questions FOR UPDATE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));
CREATE POLICY "Admin+ can delete quiz_questions" ON public.quiz_questions FOR DELETE TO authenticated USING (is_org_admin_or_owner(auth.uid(), organization_id));

-- Storage bucket for question media
INSERT INTO storage.buckets (id, name, public) VALUES ('question-media', 'question-media', true);

-- Storage RLS for question-media bucket
CREATE POLICY "Members can view question media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'question-media');
CREATE POLICY "Admin+ can upload question media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-media');
CREATE POLICY "Admin+ can update question media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'question-media');
CREATE POLICY "Admin+ can delete question media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'question-media');

-- Function to get next question global ID
CREATE OR REPLACE FUNCTION public.next_question_id()
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT nextval('public.question_global_id_seq')
$$;
