from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest

from app.contracts.worker import StageWork
from app.worker.client import WorkerClient, api_origin
from app.worker.manifest import MANIFEST_HASH
from app.worker.runtime import execute


def work():
    return StageWork(job_id=uuid4(),stage_id=uuid4(),lease_generation=1,
        lease_expires_at=datetime.now(timezone.utc)+timedelta(minutes=1),capability='synthetic-test-capability',
        input_revision_id=uuid4(),pipeline_version='orchestration-probe-v1',input_hash='a'*64,
        stage_key='orchestration:probe',model_manifest_hash=MANIFEST_HASH,worker_id='synthetic',backend='owned_worker')


@pytest.mark.parametrize('origin', ['http://example.com','https://user:pass@example.com',
    'https://example.com/path','https://example.com?secret=value','http://169.254.169.254'])
def test_outbound_origin_rejects_plaintext_credentials_paths_and_metadata(origin):
    with pytest.raises(ValueError):
        api_origin(origin,allow_loopback=True)


def test_denied_capability_never_starts_model_process(monkeypatch):
    started=[]
    monkeypatch.setattr('app.worker.runtime.subprocess.Popen',lambda *args,**kwargs: started.append(True))
    client=WorkerClient('https://synthetic.example',transport=httpx.MockTransport(
        lambda request: httpx.Response(401,json={'code':'invalid_capability'})))
    try:
        with pytest.raises(httpx.HTTPStatusError):
            execute(client,work(),'app.worker.handler:probe')
        assert not started
    finally:
        client.close()


def test_stage_transport_does_not_follow_redirects_with_capability():
    calls=[]
    def redirect(request):
        calls.append(str(request.url))
        return httpx.Response(302,headers={'Location':'https://unrelated.example'})
    client=WorkerClient('https://synthetic.example',transport=httpx.MockTransport(redirect))
    try:
        with pytest.raises(httpx.HTTPStatusError):
            client.stage(work(),'heartbeat')
        assert len(calls)==1
    finally:
        client.close()
