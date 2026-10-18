from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.auth.access import ActorView, require_actor
from app.contracts.pipeline import EvidenceBundle
from app.contracts.worker import StagePublish
from app.services.jobs import Jobs
from app.services.storage import LocalPrivateStorage, StorageUnavailable
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from product_helpers import save_assessment
from test_submissions import init_upload, submit, wav, workspace
from test_worker_http import worker_workspace, claim
from test_assessments import structured_fixture
from app.pipeline.assessment_persistence import source_review_required


def test_delete_fences_work_denies_other_users_and_recovers_storage_failure(database,tmp_path,monkeypatch):
    with worker_workspace(database,tmp_path) as (client,data,app,worker):
        content=wav(1)
        uploaded=init_upload(client,content,'audio/wav')
        assert client.put(uploaded['upload_path'],content=content,headers={'Content-Type':'audio/wav'}).status_code==200
        accepted=submit(client,{'attachment_ids':[uploaded['attachment_id']]}).json()
        sid=UUID(accepted['submission_id'])
        path='/v1/submissions/'+str(sid)
        with database.transaction() as c:
            storage_path=tmp_path/c.execute('SELECT object_path FROM public.attachments WHERE id=%s',(uploaded['attachment_id'],)).fetchone()['object_path']
        assert storage_path.exists()
        value=save_assessment(database,sid,UUID(accepted['revision_id']))
        work=claim(client,worker,['extract:audio']).json()['claim']
        claims=Capabilities(app.state.settings.stage_capability_signing_key).verify(work['capability'],UUID(work['stage_id']))
        body={'expected_revision_id':accepted['revision_id']}
        app.dependency_overrides[require_actor]=lambda:ActorView(id=data['people'][1],role='applicant',cohorts=[])
        assert client.request('DELETE',path,json=body).status_code==404
        app.dependency_overrides[require_actor]=lambda:ActorView(id=data['people'][0],role='applicant',cohorts=[])
        assert client.request('DELETE',path,json={'expected_revision_id':str(uuid4())}).status_code==409
        assert client.get('/v1/uploads/'+uploaded['attachment_id']+'/content').content==content
        delete=LocalPrivateStorage.delete
        def unavailable(*_):
            raise StorageUnavailable('Synthetic outage; no provider call')
        monkeypatch.setattr(LocalPrivateStorage,'delete',unavailable)
        result=client.request('DELETE',path,json=body)
        assert result.status_code==202 and result.json()['status']=='cleanup_pending'
        assert client.get(path).status_code==404
        assert client.get('/v1/uploads/'+uploaded['attachment_id']+'/content').status_code==404
        assert client.get(path+'/report').status_code==404
        jobs=Jobs(database,app.state.settings)
        with pytest.raises(HTTPException):
            jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=EvidenceBundle(evidence=[]).model_dump(mode='json')))
        monkeypatch.setattr(LocalPrivateStorage,'delete',delete)
        assert client.request('DELETE',path,json=body).json()['status']=='deleted'
        with database.transaction() as c:
            for table in ('submissions','attachments','submission_versions','assessments','processing_jobs'):
                column='id' if table=='submissions' else 'submission_id'
                assert c.execute(f'SELECT count(*) AS n FROM public.{table} WHERE {column}=%s',(sid,)).fetchone()['n']==0
            audit=c.execute("SELECT safe_metadata FROM public.audit_events WHERE resource_id=%s AND event_type='submission_deleted'",(sid,)).fetchone()
            assert audit['safe_metadata']=={}
            assert c.execute('SELECT 1 FROM public.submissions WHERE id=%s',(data['submissions'][1],)).fetchone()
        assert not storage_path.exists()
        assert client.get(path+'/assessment?version='+str(value.version)).status_code==404


def test_json_size_limits_cover_declared_and_chunked_bodies_without_echoing_data(database,tmp_path):
    with workspace(database,tmp_path) as (client,_,_):
        oversized=b'{"text":"'+b'x'*(260*1024)+b'"}'
        for payload in (oversized,iter([oversized[:200000],oversized[200000:]])):
            response=client.post('/v1/submissions',content=payload,headers={'Content-Type':'application/json','Idempotency-Key':str(uuid4())})
            assert response.status_code==413,response.text
            assert 'xxxx' not in response.text
        assert client.post('/v1/submissions',content=b'{invalid',headers={'Content-Type':'application/json','Idempotency-Key':str(uuid4())}).status_code==422
        assert client.get('/health/live').status_code==200


def test_trusted_exact_revision_language_review_clears_detector_uncertainty_only():
    bundle=structured_fixture()
    for segment in bundle.evidence:
        segment.language.needs_confirmation=True
    assert source_review_required(bundle)
    assert not source_review_required(bundle,verified=True,input_kind='text',language='en')
    bundle.evidence[0].translation_uncertain=True
    assert source_review_required(bundle,verified=True,input_kind='text',language='en')
    bundle.evidence[0].translation_uncertain=False
    bundle.evidence[0].language.code='hi'
    assert source_review_required(bundle,verified=True,input_kind='text',language='en')
    assert source_review_required(bundle,verified=True,input_kind='audio',language='hi')
