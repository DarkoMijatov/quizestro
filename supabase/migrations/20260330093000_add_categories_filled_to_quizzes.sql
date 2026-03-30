ALTER TABLE public.quizzes
ADD COLUMN categories_filled boolean NOT NULL DEFAULT false;

UPDATE public.quizzes
SET categories_filled = true
WHERE scoring_mode = 'per_category';

UPDATE public.quizzes q
SET categories_filled = true
WHERE q.scoring_mode = 'per_part'
  AND EXISTS (
    SELECT 1
    FROM public.scores s
    WHERE s.quiz_id = q.id
      AND (COALESCE(s.points, 0) <> 0 OR COALESCE(s.bonus_points, 0) <> 0)
  );
