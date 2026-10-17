-- SECURITY DEFINER helpers avoid recursive RLS lookups. They always use the caller's verified subject.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
$$;
CREATE OR REPLACE FUNCTION public.can_review_cohort(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT public.is_admin() OR EXISTS(SELECT 1 FROM public.cohort_memberships m JOIN public.profiles p ON p.id=m.user_id
    WHERE m.user_id=auth.uid() AND m.cohort_id=target AND m.role='assessor' AND p.role IN ('assessor','admin'))
$$;
CREATE OR REPLACE FUNCTION public.can_read_submission(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.submissions s WHERE s.id=target AND s.deleted_at IS NULL
    AND (s.owner_id=auth.uid() OR public.is_admin() OR public.can_review_cohort(s.cohort_id)))
$$;
REVOKE ALL ON FUNCTION public.is_admin(),public.can_review_cohort(uuid),public.can_read_submission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(),public.can_review_cohort(uuid),public.can_read_submission(uuid) TO authenticated,service_role;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','cohorts','cohort_memberships','submissions','submission_versions',
    'attachments','source_segments','business_records','processing_jobs','job_stages','stage_publications',
    'assessments','domain_ratings','idea_embeddings','location_queries','clarifications','review_actions',
    'audit_events','api_idempotency','shared_limits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',table_name);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT SELECT ON public.profiles,public.cohorts,public.cohort_memberships,public.submissions,public.submission_versions,
  public.attachments,public.source_segments,public.business_records,public.processing_jobs,public.assessments,
  public.domain_ratings,public.idea_embeddings,public.location_queries,public.clarifications,public.review_actions TO authenticated;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS cohorts_read ON public.cohorts;
CREATE POLICY cohorts_read ON public.cohorts FOR SELECT TO authenticated USING(public.is_admin() OR EXISTS(
  SELECT 1 FROM public.cohort_memberships WHERE cohort_id=id AND user_id=auth.uid()));
DROP POLICY IF EXISTS memberships_read ON public.cohort_memberships;
CREATE POLICY memberships_read ON public.cohort_memberships FOR SELECT TO authenticated
USING(user_id=auth.uid() OR public.can_review_cohort(cohort_id));
DROP POLICY IF EXISTS submissions_read ON public.submissions;
CREATE POLICY submissions_read ON public.submissions FOR SELECT TO authenticated USING(public.can_read_submission(id));
DROP POLICY IF EXISTS attachments_read ON public.attachments;
CREATE POLICY attachments_read ON public.attachments FOR SELECT TO authenticated
USING(status<>'deleted' AND (owner_id=auth.uid() OR public.can_read_submission(submission_id)));

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['submission_versions','source_segments','business_records','processing_jobs',
    'assessments','idea_embeddings','location_queries','clarifications','review_actions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS scoped_read ON public.%I',table_name);
    EXECUTE format('CREATE POLICY scoped_read ON public.%I FOR SELECT TO authenticated USING(public.can_read_submission(submission_id))',table_name);
  END LOOP;
END $$;
DROP POLICY IF EXISTS domain_ratings_read ON public.domain_ratings;
CREATE POLICY domain_ratings_read ON public.domain_ratings FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.assessments a WHERE a.id=assessment_id AND public.can_read_submission(a.submission_id)));

-- No browser write grants. Trusted server transactions validate claims and resource ownership again.
-- Worker-only stages/publications, audit, idempotency and shared limits have no applicant SELECT policy.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('originals','originals',false,26214400,ARRAY['application/pdf','audio/mp4','video/mp4','audio/ogg','audio/webm','audio/mpeg','audio/wav'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS original_files_read ON storage.objects;
CREATE POLICY original_files_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='originals' AND EXISTS(
  SELECT 1 FROM public.attachments a WHERE a.bucket=bucket_id AND a.object_path=name AND a.status IN ('uploaded','attached')
    AND (a.owner_id=auth.uid() OR public.can_read_submission(a.submission_id))));
-- Upload/sign/delete are server-controlled; an object path prefix alone is never an authorization proof.
