-- Preserve owner/admin/assigned-assessor visibility with set-based RLS.
-- Per-row SECURITY DEFINER lookups saturated the local 10,000-row load test.
-- No browser write grants, data changes or worker/publication access added.
DROP POLICY IF EXISTS submissions_read ON public.submissions;
CREATE POLICY submissions_read ON public.submissions FOR SELECT TO authenticated USING(
  deleted_at IS NULL AND (
    owner_id=(SELECT auth.uid()) OR (SELECT public.is_admin()) OR cohort_id IN (
      SELECT m.cohort_id FROM public.cohort_memberships m JOIN public.profiles p ON p.id=m.user_id
      WHERE m.user_id=(SELECT auth.uid()) AND m.role='assessor' AND p.role IN ('assessor','admin')
    )
  )
);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['submission_versions','source_segments','business_records','processing_jobs',
    'assessments','idea_embeddings','location_queries','clarifications','review_actions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS scoped_read ON public.%I',table_name);
    EXECUTE format('CREATE POLICY scoped_read ON public.%I FOR SELECT TO authenticated USING(submission_id IN (SELECT id FROM public.submissions))',table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS attachments_read ON public.attachments;
CREATE POLICY attachments_read ON public.attachments FOR SELECT TO authenticated USING(
  status<>'deleted' AND (owner_id=(SELECT auth.uid()) OR submission_id IN (SELECT id FROM public.submissions))
);
DROP POLICY IF EXISTS domain_ratings_read ON public.domain_ratings;
CREATE POLICY domain_ratings_read ON public.domain_ratings FOR SELECT TO authenticated USING(
  assessment_id IN (SELECT id FROM public.assessments)
);
DROP POLICY IF EXISTS feature_cache_read ON public.feature_cache;
CREATE POLICY feature_cache_read ON public.feature_cache FOR SELECT TO authenticated USING(
  submission_id IN (SELECT id FROM public.submissions)
);
