CREATE OR REPLACE FUNCTION public.claim_stage(worker text,backend_filter text,seconds integer DEFAULT 180,max_attempts integer DEFAULT 3)
RETURNS SETOF public.job_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE chosen public.job_stages; BEGIN
  IF worker IS NULL OR length(worker)<3 OR seconds NOT BETWEEN 30 AND 900 OR max_attempts NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'invalid claim limits' USING ERRCODE='22023';
  END IF;
  SELECT st.* INTO chosen FROM public.job_stages st JOIN public.processing_jobs j ON j.id=st.job_id
  JOIN public.submissions s ON s.id=j.submission_id
  WHERE j.backend=backend_filter AND s.deleted_at IS NULL
    AND j.status NOT IN ('completed','failed','cancelled','needs_review','quota_exhausted')
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

CREATE OR REPLACE FUNCTION public.heartbeat_stage(target uuid,worker text,generation bigint,seconds integer DEFAULT 180)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF seconds NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'invalid lease limit' USING ERRCODE='22023'; END IF;
  UPDATE public.job_stages st SET lease_until=clock_timestamp()+make_interval(secs=>seconds)
  FROM public.processing_jobs j WHERE st.id=target AND j.id=st.job_id AND j.status NOT IN ('cancelled','failed')
    AND st.status='running' AND st.lease_owner=worker AND st.lease_generation=generation AND st.lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.publish_stage(target uuid,worker text,generation bigint,output_hash text,
  model_hash text,schema_ver text,output jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE chosen public.job_stages; previous public.stage_publications; BEGIN
  SELECT * INTO chosen FROM public.job_stages WHERE id=target FOR UPDATE;
  IF NOT FOUND OR chosen.lease_owner IS DISTINCT FROM worker OR chosen.lease_generation<>generation THEN
    RAISE EXCEPTION 'stale or unrelated claim' USING ERRCODE='55000';
  END IF;
  IF chosen.status='completed' THEN
    SELECT * INTO previous FROM public.stage_publications WHERE stage_id=target;
    IF previous.output_hash=output_hash AND previous.model_manifest_hash=model_hash AND previous.schema_version=schema_ver THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'conflicting duplicate publication' USING ERRCODE='23505';
  END IF;
  IF chosen.status<>'running' OR chosen.lease_until<=clock_timestamp() OR EXISTS(
    SELECT 1 FROM public.processing_jobs WHERE id=chosen.job_id AND status IN ('cancelled','failed')) THEN
    RAISE EXCEPTION 'expired or cancelled claim' USING ERRCODE='55000';
  END IF;
  IF octet_length(output::text)>524288 OR schema_ver IS NULL OR output IS NULL THEN
    RAISE EXCEPTION 'invalid stage output' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.stage_publications(stage_id,lease_generation,output_hash,model_manifest_hash,schema_version,payload)
  VALUES(target,generation,output_hash,model_hash,schema_ver,output);
  UPDATE public.job_stages SET status='completed',checkpoint=output,completed_at=clock_timestamp(),lease_until=NULL
  WHERE id=target;
  UPDATE public.processing_jobs SET updated_at=clock_timestamp() WHERE id=chosen.job_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_stage(text,text,integer,integer),public.heartbeat_stage(uuid,text,bigint,integer),
  public.publish_stage(uuid,text,bigint,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stage(text,text,integer,integer),public.heartbeat_stage(uuid,text,bigint,integer),
  public.publish_stage(uuid,text,bigint,text,text,text,jsonb) TO service_role;
