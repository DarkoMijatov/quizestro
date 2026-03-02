
-- FAQ items table for dynamic FAQ management
CREATE TABLE public.faq_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_sr text NOT NULL,
  question_en text NOT NULL,
  answer_sr text NOT NULL,
  answer_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public read access (landing page, no auth needed)
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published FAQ items"
ON public.faq_items
FOR SELECT
USING (is_published = true);

-- Only service role can manage FAQ items (via edge function or direct DB)
-- No insert/update/delete policies for anon users

-- Contact form submissions
CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (no auth required for landing page)
CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- No select/update/delete for public users
