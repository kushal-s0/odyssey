-- Vector operators are in extensions, including when scoped reads assume authenticated.
GRANT USAGE ON SCHEMA extensions TO authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.feature_cache (
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  feature text NOT NULL CHECK(feature IN ('explanation')),
  variant text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','ready')),
  payload jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(assessment_id,feature,variant)
);
ALTER TABLE public.feature_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_cache FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.feature_cache TO service_role;
GRANT SELECT ON public.feature_cache TO authenticated;
DROP POLICY IF EXISTS feature_cache_read ON public.feature_cache;
CREATE POLICY feature_cache_read ON public.feature_cache FOR SELECT TO authenticated
  USING(public.can_read_submission(submission_id));

CREATE INDEX IF NOT EXISTS location_queries_cache_idx ON public.location_queries(cache_key,expires_at);
CREATE INDEX IF NOT EXISTS review_actions_revision_idx ON public.review_actions(input_revision_id,created_at DESC);
