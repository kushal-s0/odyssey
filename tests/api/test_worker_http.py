import hashlib
from contextlib import contextmanager
from uuid import uuid4

from fastapi.testclient import TestClient

from app.auth.access import ActorView, require_actor
from app.config import Settings
from app.main import create_app
from app.worker.manifest import MANIFEST_HASH
from app.pipeline.normalize import normalize_text
from app.contracts.models import LanguageResult
from uuid import UUID
from test_database import ROOT, seeded
from test_submissions import init_upload, pdf, submit, workspace

BOOTSTRAP = 'synthetic-worker-test-credential-000000000000000'
SIGNING = 'synthetic-stage-test-signing-key-0000000000000000'
WORKER_HEADERS = {'Authorization': 'Bearer '+BOOTSTRAP}


@contextmanager
def worker_workspace(database, tmp_path, **options):
    with workspace(database, tmp_path, worker_credential=BOOTSTRAP,
                   stage_capability_signing_key=SIGNING, **options) as (client, data, app):
        worker = 'http-worker-'+uuid4().hex
        try:
            yield client, data, app, worker
        finally:
            with database.transaction() as c:
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s', (worker,))


def claim(client, worker, stages=None):
    return client.post('/internal/worker/claim', headers=WORKER_HEADERS, json={
        'worker_id':worker, 'supported_stages':stages or ['extract:text'], 'manifest_hash':MANIFEST_HASH})


def stage_url(work, operation):
    return f"/internal/worker/{work['stage_id']}/{operation}"


def headers(work):
    return {'Authorization':'Bearer '+work['capability']}


def test_worker_auth_stage_scope_renewal_and_duplicate_execution(database, tmp_path):
    with worker_workspace(database, tmp_path) as (client, _, _, worker):
        created = submit(client, {'text':'A synthetic tea business.'}).json()
        payload = {'worker_id':worker, 'supported_stages':['extract:text'], 'manifest_hash':MANIFEST_HASH}
        assert client.post('/internal/worker/claim', json=payload).status_code == 401
        first = claim(client, worker).json()['claim']
        assert first['job_id'] == created['job_id']
        assert claim(client, worker).json()['claim']['lease_generation'] == first['lease_generation']
        assert client.get(stage_url(first, 'input'), headers=WORKER_HEADERS).status_code == 401
        assert client.get(f'/internal/worker/{uuid4()}/input', headers=headers(first)).status_code == 401
        value = client.get(stage_url(first, 'input'), headers=headers(first))
        assert value.status_code == 200 and value.json()['source_text'] == 'A synthetic tea business.'
        execution = {'execution_id':str(uuid4())}
        assert client.post(stage_url(first,'begin'), headers=headers(first), json=execution).status_code == 200
        # A lost begin response can be replayed by its invocation. A duplicate
        # event has a fresh execution ID and must not start a second model call.
        assert client.post(stage_url(first,'begin'), headers=headers(first), json=execution).status_code == 200
        assert client.post(stage_url(first,'begin'), headers=headers(first),
                           json={'execution_id':str(uuid4())}).status_code == 409
        renewed = client.post(stage_url(first,'heartbeat'), headers=headers(first))
        assert renewed.status_code == 200
        first = renewed.json()
        checkpoint = {'payload':{'page':1}}
        assert client.post(stage_url(first,'checkpoint'), headers=headers(first), json=checkpoint).status_code == 204
        assert client.get(stage_url(first,'input'), headers=headers(first)).json()['checkpoint'] == {'page':1}
        normalized=normalize_text('A synthetic tea business.',UUID(created['submission_id']),UUID(created['revision_id']),
                                  'en',lambda text,preferred: LanguageResult(code='en',provenance='declared'))
        output = {'model_manifest_hash':MANIFEST_HASH,'payload':normalized.model_dump(mode='json')}
        assert client.post(stage_url(first,'publish'), headers=headers(first), json=output).json()['published']
        assert not client.post(stage_url(first,'publish'), headers=headers(first), json=output).json()['published']
        progress = client.get('/v1/jobs/'+created['job_id']).json()
        assert progress['completed_stages'] == 1 and progress['status'] == 'waiting_for_worker'
        with database.transaction() as c:
            assert c.execute('SELECT count(*) AS n FROM public.stage_publications WHERE stage_id=%s',
                             (first['stage_id'],)).fetchone()['n'] == 1


def test_job_scope_cancel_resume_fencing_and_quota(database, tmp_path):
    with worker_workspace(database, tmp_path) as (client, data, app, worker):
        created = submit(client, {'text':'A synthetic repair business.'}).json()
        work = claim(client, worker).json()['claim']
        path = '/v1/jobs/'+created['job_id']
        owner = app.dependency_overrides[require_actor]
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1],role='applicant',cohorts=[])
        for method, suffix, payload in [('get','',None),('post','/cancel',None),('post','/resume',{
                'expected_revision_id':created['revision_id']})]:
            response = getattr(client, method)(path+suffix, **({'json':payload} if payload else {}))
            assert response.status_code == 404
        app.dependency_overrides[require_actor] = owner
        assert client.post(path+'/cancel').json()['status'] == 'cancelled'
        for op in ['heartbeat','checkpoint','publish']:
            payload = {'payload':{}} if op == 'checkpoint' else {
                'payload':{},'model_manifest_hash':MANIFEST_HASH} if op == 'publish' else None
            assert client.post(stage_url(work,op), headers=headers(work), json=payload).status_code == 409
        assert client.post(path+'/resume',json={'expected_revision_id':str(uuid4())}).status_code == 409
        assert client.post(path+'/resume',json={'expected_revision_id':created['revision_id']}).status_code == 200
        replacement = claim(client, worker).json()['claim']
        assert replacement['lease_generation'] > work['lease_generation']
        assert client.post(stage_url(replacement,'failure'),headers=headers(replacement),
                           json={'code':'quota_exhausted'}).status_code == 204
        progress = client.get(path).json()
        assert progress['status'] == 'quota_exhausted' and progress['error']['code'] == 'quota_exhausted'
        assert client.post(path+'/resume',json={'expected_revision_id':created['revision_id']}).status_code == 200


def test_private_worker_source_is_fresh_scoped_and_hash_checked(database, tmp_path):
    content = pdf(1)
    with worker_workspace(database, tmp_path) as (client, _, _, worker):
        upload = init_upload(client, content)
        assert client.put(upload['upload_path'],content=content,headers={'Content-Type':'application/pdf'}).status_code == 200
        created = submit(client, {'attachment_ids':[upload['attachment_id']]}).json()
        work = claim(client, worker, ['extract:pdf']).json()['claim']
        access = client.post(stage_url(work,'source'), headers=headers(work)).json()
        assert access['sha256'] == hashlib.sha256(content).hexdigest()
        assert client.get(access['path']).status_code == 401
        assert client.get(access['path'], headers=headers(work)).content == content
        with database.transaction() as c:
            stored=c.execute('SELECT object_path FROM public.attachments WHERE id=%s', (upload['attachment_id'],)).fetchone()
        (tmp_path/stored['object_path']).write_bytes(b'synthetic-corruption')
        assert client.get(access['path'], headers=headers(work)).status_code == 503
        client.post('/v1/jobs/'+created['job_id']+'/cancel')
        assert client.get(access['path'],headers=headers(work)).status_code == 409


def test_startup_reconciles_expired_leases_and_retry_budget(database):
    with seeded(database) as data:
        with database.transaction() as c:
            c.execute("UPDATE public.job_stages SET status='running',lease_owner='dead-worker',lease_generation=1,lease_until=now()-interval '1 second',attempts=3 WHERE id=%s", (data['stage'],))
        app = create_app(Settings(_env_file=None,app_env='test', database_url=(ROOT/'.local/test-database-url').read_text().strip()))
        with TestClient(app):
            with database.transaction() as c:
                row = c.execute('SELECT status,error_code FROM public.processing_jobs WHERE id=%s',(data['job'],)).fetchone()
                assert row['status'] == 'failed' and row['error_code'] == 'retry_budget_exhausted'


def test_capability_and_source_failure_do_not_disclose_tokens(database, tmp_path):
    with worker_workspace(database, tmp_path) as (client, _, _, worker):
        submit(client, {'text':'Synthetic business.'})
        work = claim(client, worker).json()['claim']
        response = client.get(stage_url(work,'input'),headers={'Authorization':'Bearer '+work['capability']+'bad'})
        assert response.status_code == 401 and work['capability'] not in response.text
        assert client.post(stage_url(work,'checkpoint'),headers=headers(work),json={'payload':{'large':'x'*460000}}).status_code == 422
