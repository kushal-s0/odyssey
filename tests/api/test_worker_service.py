from contextlib import contextmanager
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.contracts.worker import StageFailure, StagePublish, WorkerRequest
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from test_database import seeded


@contextmanager
def service(database):
    settings = Settings(_env_file=None, app_env='test', stage_capability_signing_key='synthetic-local-capability-key-0000000000000000')
    instance = Jobs(database, settings)
    workers = []
    def worker():
        identity = 'test-worker-'+uuid4().hex
        workers.append(identity)
        return WorkerRequest(worker_id=identity, supported_stages=['extract:text'], manifest_hash=MANIFEST_HASH)
    try:
        yield instance, worker
    finally:
        with database.transaction() as connection:
            connection.execute('DELETE FROM public.worker_runtimes WHERE worker_id=ANY(%s)', (workers,))


def claims(instance, work):
    return Capabilities(instance.settings.stage_capability_signing_key).verify(work.capability, work.stage_id)


def test_lost_claim_response_heartbeat_checkpoint_and_duplicate_publication(database):
    with seeded(database) as data, service(database) as (instance, worker):
        request = worker()
        first = instance.claim(request)
        assert first and first.stage_id == data['stage']
        retried = instance.claim(request)
        assert retried and retried.stage_id == first.stage_id and retried.lease_generation == 1
        verified = claims(instance, first)
        renewed = instance.heartbeat(verified)
        assert renewed.lease_expires_at >= first.lease_expires_at
        instance.checkpoint(claims(instance, renewed), {'probe':'durable-checkpoint'})
        with database.transaction() as connection:
            row = connection.execute('SELECT checkpoint,attempts FROM public.job_stages WHERE id=%s', (first.stage_id,)).fetchone()
            assert row['checkpoint'] == {'probe':'durable-checkpoint'} and row['attempts'] == 1
        output = StagePublish(model_manifest_hash=MANIFEST_HASH, payload={'probe':'orchestration-only'})
        assert instance.publish(verified, output) == {'published':True, 'status':'completed'}
        assert instance.publish(verified, output) == {'published':False, 'status':'completed'}
        with pytest.raises(HTTPException) as conflict:
            instance.publish(verified, StagePublish(model_manifest_hash=MANIFEST_HASH, payload={'different':True}))
        assert conflict.value.status_code == 409
        assert instance.view(data['job']).completed_stages == 1


def test_expired_generation_cannot_checkpoint_or_publish_after_reclaim(database):
    with seeded(database), service(database) as (instance, worker):
        first = instance.claim(worker())
        assert first
        stale = claims(instance, first)
        with database.transaction() as connection:
            connection.execute("UPDATE public.job_stages SET lease_until=now()-interval '1 second' WHERE id=%s", (first.stage_id,))
        second = instance.claim(worker())
        assert second and second.stage_id == first.stage_id and second.lease_generation == 2
        with pytest.raises(HTTPException) as denied:
            instance.checkpoint(stale, {'late':True})
        assert denied.value.status_code == 409
        with pytest.raises(HTTPException):
            instance.publish(stale, StagePublish(model_manifest_hash=MANIFEST_HASH,payload={'late':True}))
        with pytest.raises(HTTPException):
            Capabilities(instance.settings.stage_capability_signing_key).verify(second.capability, uuid4())


def test_offline_backend_and_quota_states_preserve_input(database):
    with seeded(database) as data, service(database) as (instance, worker):
        instance.reconcile()
        assert instance.view(data['job']).status == 'waiting_for_worker'
        with database.transaction() as connection:
            connection.execute("UPDATE public.processing_jobs SET backend='hf_zerogpu' WHERE id=%s", (data['job'],))
        instance.reconcile()
        assert instance.view(data['job']).status == 'waiting_for_runtime'
        with database.transaction() as connection:
            connection.execute("UPDATE public.processing_jobs SET backend='owned_worker' WHERE id=%s", (data['job'],))
        work = instance.claim(worker())
        assert work
        instance.fail(claims(instance, work), StageFailure(code='quota_exhausted', retry_after_seconds=60))
        instance.reconcile()
        assert instance.view(data['job']).status == 'quota_exhausted'
        with database.transaction() as connection:
            row = connection.execute('SELECT source_text FROM public.submission_versions WHERE id=%s', (data['revisions'][0],)).fetchone()
            assert row['source_text'] == 'Synthetic DB test'


def test_wrong_manifest_is_rejected_before_claim(database):
    with seeded(database), service(database) as (instance, worker):
        request = worker()
        request.manifest_hash = '0'*64
        with pytest.raises(HTTPException) as denied:
            instance.claim(request)
        assert denied.value.status_code == 409
