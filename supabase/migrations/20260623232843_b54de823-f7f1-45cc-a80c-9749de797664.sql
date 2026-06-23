
-- 1) Enforce Free plan limits server-side via triggers

CREATE OR REPLACE FUNCTION public.enforce_free_plan_membership_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count INT;
BEGIN
  IF public.can_use_pro_features(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO member_count
  FROM public.memberships
  WHERE organization_id = NEW.organization_id;

  -- Free plan: only the owner allowed (1 member total)
  IF member_count >= 1 THEN
    RAISE EXCEPTION 'Free plan member limit reached. Upgrade to Pro to add more members.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_plan_membership_limit_trg ON public.memberships;
CREATE TRIGGER enforce_free_plan_membership_limit_trg
BEFORE INSERT ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_membership_limit();


CREATE OR REPLACE FUNCTION public.enforce_free_plan_quiz_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quiz_count INT;
BEGIN
  IF public.can_use_pro_features(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO quiz_count
  FROM public.quizzes
  WHERE organization_id = NEW.organization_id
    AND created_at >= date_trunc('year', now());

  IF quiz_count >= 20 THEN
    RAISE EXCEPTION 'Free plan quiz limit (20 per year) reached. Upgrade to Pro for unlimited quizzes.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_plan_quiz_limit_trg ON public.quizzes;
CREATE TRIGGER enforce_free_plan_quiz_limit_trg
BEFORE INSERT ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_quiz_limit();


-- 2) Rate limit contact form submissions (max 3 per email per hour)

CREATE OR REPLACE FUNCTION public.enforce_contact_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.contact_submissions
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many submissions. Please wait before sending another message.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_contact_submission_rate_limit_trg ON public.contact_submissions;
CREATE TRIGGER enforce_contact_submission_rate_limit_trg
BEFORE INSERT ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_submission_rate_limit();
