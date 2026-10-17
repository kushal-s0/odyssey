from uuid import uuid4

import httpx
import pytest

from app.config import Settings
from app.contracts.worker import StagePublish
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.gradio import GradioAdapter, dispatch_one
from app.worker.manifest import MANIFEST_HASH
from test_database import seeded
from test_worker_http import SIGNING


def test_lost_gradio_enqueue_response_is_durable_and_not_blindly_retried(database):
    calls, events = [], []
    config = Settings(_env_file=None,app_env='test',model_runtime='hf_zerogpu',
        text_document_space_url='https://synthetic-owned-test.hf.space',stage_capability_signing_key=SIGNING)
    jobs = Jobs(database,config)
    def lose_response(request):
        import json
        calls.append(request.url.path)
        events.append(json.loads(json.loads(request.content)['data'][0]))
        raise httpx.ReadTimeout('Synthetic lost enqueue response')
    adapter = GradioAdapter(config.text_document_space_url,transport=httpx.MockTransport(lose_response))
    with seeded(database) as data:
        try:
            with database.transaction() as c:
                c.execute("UPDATE public.processing_jobs SET backend='hf_zerogpu' WHERE id=%s", (data['job'],))
            assert dispatch_one(jobs,adapter=adapter)['state']=='uncertain'
            assert dispatch_one(jobs,adapter=adapter)['state']=='already_dispatched'
            assert len(calls)==1
            with database.transaction() as c:
                row = c.execute('SELECT state,event_id FROM public.runtime_dispatches WHERE stage_id=%s',(data['stage'],)).fetchone()
                assert row=={'state':'uncertain','event_id':None}
                c.execute("UPDATE public.job_stages SET lease_until=now()-interval '1 second' WHERE id=%s",(data['stage'],))
            def receipt(request):
                calls.append(request.url.path)
                return httpx.Response(200,json={'event_id':'synthetic-event-2'})
            adapter.transport=httpx.MockTransport(receipt)
            assert dispatch_one(jobs,adapter=adapter)['state']=='enqueued'
            assert len(calls)==2
            stale = events[0]
            verified = Capabilities(config.stage_capability_signing_key).verify(stale['capability'],data['stage'])
            import pytest
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as failure:
                jobs.begin(verified,uuid4())
            assert failure.value.status_code==409
            with database.transaction() as c:
                row=c.execute('SELECT * FROM public.job_stages WHERE id=%s',(data['stage'],)).fetchone()
                job=c.execute('SELECT * FROM public.processing_jobs WHERE id=%s',(data['job'],)).fetchone()
                assert row['event_id']=='synthetic-event-2' and row['lease_generation']==2
            work=jobs.work(row,job)
            current=Capabilities(config.stage_capability_signing_key).verify(work.capability,work.stage_id)
            jobs.begin(current,uuid4())
            result=StagePublish(model_manifest_hash=MANIFEST_HASH,payload={'probe':'gradio-orchestration-only'})
            assert jobs.publish(current,result)['published']
            assert not jobs.publish(current,result)['published']
        finally:
            with database.transaction() as c:
                c.execute("DELETE FROM public.worker_runtimes WHERE worker_id IN ('hf-text-document','hf-speech-translation')")


@pytest.mark.parametrize('status,expected',[(429,'quota_exhausted'),(503,'waiting_for_runtime'),(403,'needs_review')])
def test_definite_gradio_rejections_expose_quota_sleep_and_access_states(database,status,expected):
    config=Settings(_env_file=None,app_env='test',model_runtime='hf_zerogpu',
        text_document_space_url='https://synthetic-owned-test.hf.space',stage_capability_signing_key=SIGNING)
    jobs=Jobs(database,config)
    adapter=GradioAdapter(config.text_document_space_url,transport=httpx.MockTransport(
        lambda request: httpx.Response(status,headers={'Retry-After':'75'})))
    with seeded(database) as data:
        try:
            with database.transaction() as c:
                c.execute("UPDATE public.processing_jobs SET backend='hf_zerogpu' WHERE id=%s",(data['job'],))
                c.execute("UPDATE public.job_stages SET checkpoint='{}'::jsonb WHERE id=%s",(data['stage'],))
            dispatch_one(jobs,adapter=adapter)
            jobs.reconcile()
            assert jobs.view(data['job']).status==expected
            with database.transaction() as c:
                row=c.execute('SELECT checkpoint,lease_until,retry_at>now() AS deferred FROM public.job_stages WHERE id=%s',
                              (data['stage'],)).fetchone()
                assert row['checkpoint']=={} and row['lease_until'] is None and row['deferred']
        finally:
            with database.transaction() as c:
                c.execute("DELETE FROM public.worker_runtimes WHERE worker_id IN ('hf-text-document','hf-speech-translation')")
