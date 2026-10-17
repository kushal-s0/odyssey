CREATE TABLE IF NOT EXISTS public.worker_runtimes (
  worker_id text PRIMARY KEY CHECK(length(worker_id) BETWEEN 3 AND 100),
  backend text NOT NULL CHECK(backend IN ('owned_worker','hf_zerogpu')),
  supported_stages text[] NOT NULL, manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('idle','busy','offline')),
  last_seen timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.worker_runtimes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_runtimes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.worker_runtimes TO service_role;

CREATE OR REPLACE FUNCTION public.claim_compatible_stage(worker text,backend_filter text,
  seconds integer,max_attempts integer,supported text[])
RETURNS SETOF public.job_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE chosen public.job_stages; BEGIN
  IF worker IS NULL OR length(worker) NOT BETWEEN 3 AND 100 OR seconds NOT BETWEEN 30 AND 900
    OR max_attempts NOT BETWEEN 1 AND 5 OR cardinality(supported) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid claim limits' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim-worker:'||worker,0));
  -- Retry a lost claim response without issuing a second concurrent claim or consuming an attempt.
  SELECT st.* INTO chosen FROM public.job_stages st JOIN public.processing_jobs j ON j.id=st.job_id
    JOIN public.submissions s ON s.id=j.submission_id
    WHERE st.lease_owner=worker AND st.status='running' AND st.lease_until>clock_timestamp()
      AND j.backend=backend_filter AND st.stage_key=ANY(supported) AND s.deleted_at IS NULL
      AND j.status NOT IN ('completed','failed','cancelled','needs_review','quota_exhausted')
    ORDER BY st.id FOR UPDATE OF st LIMIT 1;
  IF FOUND THEN RETURN NEXT chosen; RETURN; END IF;
  SELECT st.* INTO chosen FROM public.job_stages st JOIN public.processing_jobs j ON j.id=st.job_id
    JOIN public.submissions s ON s.id=j.submission_id
    WHERE j.backend=backend_filter AND s.deleted_at IS NULL AND st.stage_key=ANY(supported)
      AND j.status NOT IN ('completed','partial','failed','cancelled','needs_review','quota_exhausted')
      AND st.attempts<max_attempts AND st.retry_at<=clock_timestamp()
      AND (st.status='pending' OR (st.status='running' AND st.lease_until<=clock_timestamp()))
      AND NOT EXISTS(SELECT 1 FROM public.job_stages earlier WHERE earlier.job_id=st.job_id
        AND earlier.stage_order<st.stage_order AND earlier.status<>'completed')
    ORDER BY j.created_at,st.stage_order,st.id FOR UPDATE OF st SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.job_stages SET status='running',attempts=attempts+1,lease_generation=lease_generation+1,
    lease_owner=worker,lease_until=clock_timestamp()+make_interval(secs=>seconds),error_code=NULL
    WHERE id=chosen.id RETURNING * INTO chosen;
  UPDATE public.processing_jobs SET status=CASE
    WHEN chosen.stage_key LIKE 'extract%' THEN 'extracting' WHEN chosen.stage_key LIKE 'translat%' THEN 'translating'
    WHEN chosen.stage_key LIKE 'structur%' THEN 'structuring' WHEN chosen.stage_key LIKE 'assess%' THEN 'assessing'
    ELSE 'enriching' END,updated_at=clock_timestamp() WHERE id=chosen.job_id;
  RETURN NEXT chosen;
END $$;
REVOKE ALL ON FUNCTION public.claim_compatible_stage(text,text,integer,integer,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_compatible_stage(text,text,integer,integer,text[]) TO service_role;

-- Complete existing durable intents without rerunning completed work. Original migration remains immutable.
INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash)
SELECT j.id,steps.key,steps.n,v.input_hash FROM public.processing_jobs j
JOIN public.submission_versions v ON v.id=j.input_revision_id
CROSS JOIN (VALUES('translate',1),('structure',2),('assess',3)) AS steps(key,n)
WHERE j.pipeline_version='screening-v1'
ON CONFLICT DO NOTHING;
