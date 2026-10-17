-- A delivery may be duplicated before the first result is published. Only one
-- execution invocation may enter inference for each fenced lease generation.
CREATE TABLE IF NOT EXISTS public.stage_executions (
  stage_id uuid NOT NULL REFERENCES public.job_stages(id) ON DELETE CASCADE,
  lease_generation bigint NOT NULL CHECK(lease_generation>0),
  execution_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(stage_id,lease_generation)
);
ALTER TABLE public.stage_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stage_executions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.stage_executions TO service_role;

CREATE TABLE IF NOT EXISTS public.runtime_dispatches (
  stage_id uuid NOT NULL REFERENCES public.job_stages(id) ON DELETE CASCADE,
  lease_generation bigint NOT NULL CHECK(lease_generation>0),
  state text NOT NULL CHECK(state IN ('enqueuing','enqueued','uncertain','unavailable')),
  event_id text CHECK(length(event_id)<=200),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(stage_id,lease_generation)
);
ALTER TABLE public.runtime_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runtime_dispatches FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.runtime_dispatches TO service_role;
