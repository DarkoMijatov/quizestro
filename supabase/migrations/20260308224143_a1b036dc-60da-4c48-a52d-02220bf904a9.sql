
-- Fix function search path
CREATE OR REPLACE FUNCTION public.next_question_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.question_global_id_seq')
$$;
