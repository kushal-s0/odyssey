CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path=public,extensions;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant','assessor','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  synthetic boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cohort_memberships (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('applicant','assessor')), PRIMARY KEY(user_id,cohort_id)
);
CREATE INDEX IF NOT EXISTS membership_cohort_idx ON public.cohort_memberships(cohort_id,user_id);
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id),
  cohort_id uuid REFERENCES public.cohorts(id), current_revision_id uuid,
  synthetic boolean NOT NULL DEFAULT false, family_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS submissions_owner_idx ON public.submissions(owner_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS submissions_cohort_idx ON public.submissions(cohort_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS public.submission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  revision_number integer NOT NULL CHECK(revision_number>0), parent_revision_id uuid REFERENCES public.submission_versions(id),
  input_kind text NOT NULL CHECK(input_kind IN ('text','pdf','audio')), source_text text,
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  preferred_language text NOT NULL CHECK(preferred_language IN ('en','hi','mr','te','bn','or','und')),
  declared_location jsonb, consent_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(submission_id,revision_number), UNIQUE(id,submission_id),
  FOREIGN KEY(parent_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
DO $$ BEGIN
  ALTER TABLE public.submissions ADD CONSTRAINT submissions_current_revision_fk
  FOREIGN KEY(current_revision_id,id) REFERENCES public.submission_versions(id,submission_id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid REFERENCES public.submission_versions(id),
  bucket text NOT NULL DEFAULT 'originals', object_path text NOT NULL,
  filename_display text NOT NULL, media_type text NOT NULL,
  bytes bigint NOT NULL CHECK(bytes>0 AND bytes<=52428800),
  sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'), pages integer CHECK(pages>0 AND pages<=100),
  duration_seconds numeric CHECK(duration_seconds>0 AND duration_seconds<=1800),
  status text NOT NULL CHECK(status IN ('initiated','uploaded','attached','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bucket,object_path), UNIQUE(id,submission_id),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE INDEX IF NOT EXISTS attachments_owner_status_idx ON public.attachments(owner_id,status,created_at);
CREATE TABLE IF NOT EXISTS public.source_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, attachment_id uuid,
  ordinal integer NOT NULL CHECK(ordinal>=0), kind text NOT NULL CHECK(kind IN ('text','pdf','audio')),
  original_text text NOT NULL, english_text text, language jsonb NOT NULL,
  locator jsonb NOT NULL, translation_uncertain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(input_revision_id,ordinal),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id),
  FOREIGN KEY(attachment_id,submission_id) REFERENCES public.attachments(id,submission_id),
  CHECK(kind='text' OR attachment_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.business_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, pipeline_version text NOT NULL, schema_version text NOT NULL,
  model_manifest_hash text NOT NULL CHECK(model_manifest_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL, sector text NOT NULL DEFAULT 'unknown', trade text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(input_revision_id,pipeline_version),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE INDEX IF NOT EXISTS records_sector_trade_idx ON public.business_records(sector,trade,submission_id);
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, pipeline_version text NOT NULL,
  backend text NOT NULL CHECK(backend IN ('owned_worker','hf_zerogpu')),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','extracting','translating','structuring','assessing','enriching',
    'completed','partial','needs_review','waiting_for_worker','waiting_for_runtime','quota_exhausted','failed','cancelled')),
  error_code text, error_message text, request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(input_revision_id,pipeline_version),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE INDEX IF NOT EXISTS jobs_status_time_idx ON public.processing_jobs(status,created_at,id);
CREATE TABLE IF NOT EXISTS public.job_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  stage_key text NOT NULL, stage_order integer NOT NULL CHECK(stage_order>=0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','cancelled','blocked')),
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), retry_at timestamptz NOT NULL DEFAULT now(),
  lease_generation bigint NOT NULL DEFAULT 0 CHECK(lease_generation>=0), lease_owner text, lease_until timestamptz,
  event_id text, error_code text, checkpoint jsonb, completed_at timestamptz,
  UNIQUE(job_id,stage_key), UNIQUE(job_id,stage_order),
  CHECK(status<>'running' OR (lease_owner IS NOT NULL AND lease_until IS NOT NULL AND lease_generation>0))
);
CREATE INDEX IF NOT EXISTS stages_claim_idx ON public.job_stages(status,retry_at,lease_until,stage_order);
CREATE TABLE IF NOT EXISTS public.stage_publications (
  stage_id uuid PRIMARY KEY REFERENCES public.job_stages(id) ON DELETE CASCADE,
  lease_generation bigint NOT NULL,
  output_hash text NOT NULL CHECK(output_hash ~ '^[a-f0-9]{64}$'),
  model_manifest_hash text NOT NULL CHECK(model_manifest_hash ~ '^[a-f0-9]{64}$'),
  schema_version text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, pipeline_version text NOT NULL, version integer NOT NULL CHECK(version>0),
  rubric_version text NOT NULL, model_manifest_hash text NOT NULL CHECK(model_manifest_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL, potential numeric, evidence_coverage numeric NOT NULL CHECK(evidence_coverage BETWEEN 0 AND 1),
  completeness_percent numeric NOT NULL CHECK(completeness_percent BETWEEN 0 AND 100),
  ranking_eligible boolean NOT NULL, trade text NOT NULL, sector text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(input_revision_id,pipeline_version), UNIQUE(submission_id,version),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id),
  CHECK(potential IS NULL OR potential BETWEEN 0 AND 100),
  CHECK(NOT ranking_eligible OR (evidence_coverage=1 AND potential IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS assessments_compare_idx ON public.assessments(rubric_version,trade,ranking_eligible,potential DESC);
CREATE INDEX IF NOT EXISTS assessments_submission_idx ON public.assessments(submission_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.domain_ratings (
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK(domain IN ('clarity','customer_need','market_potential','feasibility','competition','differentiation')),
  rating integer CHECK(rating BETWEEN 0 AND 4), reason text NOT NULL, source_segment_ids uuid[] NOT NULL,
  PRIMARY KEY(assessment_id,domain), CHECK(rating IS NULL OR cardinality(source_segment_ids)>0)
);
CREATE TABLE IF NOT EXISTS public.idea_embeddings (
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, model_revision text NOT NULL, preprocessing_version text NOT NULL,
  vector vector(384) NOT NULL, summary_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(submission_id,model_revision,preprocessing_version),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE TABLE IF NOT EXISTS public.location_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, cache_key text NOT NULL, source text NOT NULL,
  query_area jsonb NOT NULL, result jsonb, retrieved_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE TABLE IF NOT EXISTS public.clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, question_key text NOT NULL, original_question text NOT NULL, translated_question text,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','superseded')),
  answer_revision_id uuid REFERENCES public.submission_versions(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(input_revision_id,question_key),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE TABLE IF NOT EXISTS public.review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  input_revision_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id),
  outcome text NOT NULL, reason text NOT NULL, correction_revision_id uuid REFERENCES public.submission_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(input_revision_id,submission_id) REFERENCES public.submission_versions(id,submission_id)
);
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, resource_id uuid, event_type text NOT NULL,
  request_id uuid, safe_metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.api_idempotency (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL, key_hash text NOT NULL, request_hash text NOT NULL,
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,scope,key_hash)
);
CREATE TABLE IF NOT EXISTS public.shared_limits (
  key text PRIMARY KEY, window_started_at timestamptz NOT NULL DEFAULT now(), used integer NOT NULL DEFAULT 0,
  reserved_until timestamptz
);
