
-- Create enum for media role
CREATE TYPE public.media_role AS ENUM ('supplementary', 'key');

-- Add media_role column to questions
ALTER TABLE public.questions ADD COLUMN media_role public.media_role NULL DEFAULT NULL;
