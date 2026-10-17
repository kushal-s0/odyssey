import hashlib
import os
import socket
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from uuid import uuid4

import httpx
import uvicorn

from app.config import Settings
from app.contracts.worker import WorkerRequest
from app.main import create_app
from app.worker.client import WorkerClient
from app.worker.manifest import MANIFEST_HASH
from app.worker.runtime import execute
from app.worker.capabilities import Capabilities
from test_database import ROOT, seeded
from test_worker_http import BOOTSTRAP, SIGNING


@contextmanager
def http_server(settings):
    # Actual loopback HTTP, not a mocked in-process worker transport.
    sock = socket.socket()
    sock.bind(('127.0.0.1',0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(settings), log_level='critical', access_log=False))
    thread = threading.Thread(target=server.run, kwargs={'sockets':[sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic()+10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError('Synthetic HTTP server failed to start')
        time.sleep(.05)
    try:
        yield f'http://127.0.0.1:{port}'
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()
        assert not thread.is_alive()


def configure_probe(database, data):
    digest = hashlib.sha256(b'Synthetic DB test').hexdigest()
    with database.transaction() as c:
        c.execute("UPDATE public.processing_jobs SET pipeline_version='orchestration-probe-v1' WHERE id=%s", (data['job'],))
        c.execute("UPDATE public.job_stages SET stage_key='orchestration:probe',input_hash=%s WHERE id=%s", (digest,data['stage']))
        c.execute('UPDATE public.submission_versions SET input_hash=%s WHERE id=%s',(digest,data['revisions'][0]))


def worker_process(origin, identity, tmp_path):
    env = {**os.environ, 'WORKER_CREDENTIAL':BOOTSTRAP, 'WORKER_API_URL':origin,
           'WORKER_ID':identity,'PYTHONPATH':str(ROOT/'tests/fixtures'),
           # Deliberate canaries: these must never reach the model child.
           'DATABASE_URL':'synthetic-do-not-forward', 'SUPABASE_SERVICE_ROLE_KEY':'synthetic-do-not-forward',
           'STAGE_CAPABILITY_SIGNING_KEY':'synthetic-do-not-forward', 'TEMP':str(tmp_path),'TMP':str(tmp_path)}
    return subprocess.Popen([sys.executable,'-B','-m','app.worker','--allow-loopback',
        '--handler','recovery_handler:recover','--stages','orchestration:probe',
        '--session-seconds','25','--idle-seconds','2'], env=env,
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)


def wait_for(database, stage, predicate):
    deadline = time.monotonic()+15
    while time.monotonic() < deadline:
        with database.transaction() as c:
            value = c.execute('SELECT * FROM public.job_stages WHERE id=%s',(stage,)).fetchone()
        if predicate(value):
            return value
        time.sleep(.1)
    raise AssertionError('Timed out waiting for a durable synthetic worker transition')


def process_settings():
    return Settings(_env_file=None,app_env='test',database_url=(ROOT/'.local/test-database-url').read_text().strip(),
        stage_capability_signing_key=SIGNING,worker_credential=BOOTSTRAP,lease_seconds=30)


def test_real_http_worker_termination_api_restart_and_stale_generation(database, tmp_path):
    identity = 'process-probe-'+uuid4().hex
    with seeded(database) as data:
        configure_probe(database,data)
        try:
            with http_server(process_settings()) as origin:
                first = worker_process(origin,identity,tmp_path)
                try:
                    checkpoint = wait_for(database,data['stage'],lambda row: row['checkpoint'] is not None)
                    assert checkpoint['checkpoint']['inference'] is False
                    client = WorkerClient(origin,BOOTSTRAP,allow_loopback=True)
                    stale = client.claim(WorkerRequest(worker_id=identity,supported_stages=['orchestration:probe'],manifest_hash=MANIFEST_HASH))
                    client.close()
                finally:
                    first.terminate()
                    first.wait(timeout=10)
            # Expire the lease deterministically rather than waiting 30 seconds.
            with database.transaction() as c:
                c.execute("UPDATE public.job_stages SET lease_until=now()-interval '1 second' WHERE id=%s", (data['stage'],))
            with http_server(process_settings()) as origin:
                second = worker_process(origin,identity,tmp_path)
                try:
                    result = wait_for(database,data['stage'],lambda row: row['status']=='completed')
                    assert result['lease_generation'] == checkpoint['lease_generation']+1
                    assert result['checkpoint'] == {'probe':'recovered-checkpoint','inference':False}
                    assert stale
                    response = httpx.post(f'{origin}/internal/worker/{stale.stage_id}/checkpoint',
                        headers={'Authorization':'Bearer '+stale.capability},json={'payload':{'stale':True}},trust_env=False)
                    assert response.status_code == 409
                    with database.transaction() as c:
                        assert c.execute('SELECT count(*) AS n FROM public.stage_publications WHERE stage_id=%s',
                                         (data['stage'],)).fetchone()['n'] == 1
                finally:
                    if second.poll() is None:
                        second.terminate()
                    second.wait(timeout=10)
        finally:
            with database.transaction() as c:
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s',(identity,))


def test_lost_publish_response_retries_without_second_publication(database):
    identity = 'lost-response-'+uuid4().hex
    with seeded(database) as data:
        configure_probe(database,data)
        try:
            with http_server(process_settings()) as origin:
                client = WorkerClient(origin,BOOTSTRAP,allow_loopback=True)
                original = client.http
                calls = []
                def drop_response(request):
                    response = original.send(request)
                    if request.url.path.endswith('/publish'):
                        calls.append(True)
                        if len(calls)==1:
                            raise httpx.ReadError('Synthetic lost response')
                    return response
                client.http = httpx.Client(base_url=origin,transport=httpx.MockTransport(drop_response))
                try:
                    work = client.claim(WorkerRequest(worker_id=identity,supported_stages=['orchestration:probe'],manifest_hash=MANIFEST_HASH))
                    assert work
                    execute(client,work,'app.worker.handler:probe',max_seconds=10,heartbeat_seconds=.1)
                    assert len(calls)==2
                    with database.transaction() as c:
                        assert c.execute('SELECT count(*) AS n FROM public.stage_publications WHERE stage_id=%s',
                                         (data['stage'],)).fetchone()['n']==1
                finally:
                    client.close()
                    original.close()
        finally:
            with database.transaction() as c:
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s',(identity,))


def test_hung_child_has_bounded_timeout_and_preserves_checkpoint(database, monkeypatch):
    identity='timeout-probe-'+uuid4().hex
    monkeypatch.setenv('PYTHONPATH',str(ROOT/'tests/fixtures'))
    with seeded(database) as data:
        configure_probe(database,data)
        try:
            with http_server(process_settings()) as origin:
                client=WorkerClient(origin,BOOTSTRAP,allow_loopback=True)
                try:
                    work=client.claim(WorkerRequest(worker_id=identity,supported_stages=['orchestration:probe'],manifest_hash=MANIFEST_HASH))
                    assert work
                    client.stage(work,'checkpoint',{'payload':{'durable':'preserved'}})
                    execute(client,work,'recovery_handler:hang',max_seconds=1,heartbeat_seconds=.2)
                    with database.transaction() as c:
                        row=c.execute('SELECT * FROM public.job_stages WHERE id=%s',(data['stage'],)).fetchone()
                        assert row['status']=='pending' and row['error_code']=='stage_timeout'
                        assert row['checkpoint']=={'durable':'preserved'}
                    # The old capability cannot extend a released lease.
                    from app.services.jobs import Jobs
                    import pytest
                    from fastapi import HTTPException
                    with pytest.raises(HTTPException):
                        Jobs(database,process_settings()).heartbeat(Capabilities(process_settings().stage_capability_signing_key).verify(
                            work.capability,work.stage_id))
                finally:
                    client.close()
        finally:
            with database.transaction() as c:
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s',(identity,))


def test_child_stdio_probe_and_regional_text_do_not_deadlock_or_corrupt(database,monkeypatch):
    identity='stdio-probe-'+uuid4().hex
    monkeypatch.setenv('PYTHONPATH',str(ROOT/'tests/fixtures'))
    text='चाय का प्रस्ताव। Marathi: चहाचा व्यवसाय.'
    with seeded(database) as data:
        configure_probe(database,data)
        digest=hashlib.sha256(text.encode()).hexdigest()
        with database.transaction() as c:
            c.execute('UPDATE public.submission_versions SET source_text=%s,input_hash=%s WHERE id=%s',
                      (text,digest,data['revisions'][0]))
            c.execute('UPDATE public.job_stages SET input_hash=%s WHERE id=%s',(digest,data['stage']))
        try:
            with http_server(process_settings()) as origin:
                client=WorkerClient(origin,BOOTSTRAP,allow_loopback=True)
                try:
                    work=client.claim(WorkerRequest(worker_id=identity,supported_stages=['orchestration:probe'],manifest_hash=MANIFEST_HASH))
                    assert work
                    execute(client,work,'recovery_handler:stream_probe',max_seconds=5)
                    with database.transaction() as c:
                        row=c.execute('SELECT payload FROM public.stage_publications WHERE stage_id=%s',(data['stage'],)).fetchone()
                        assert row and row['payload']['text']==text
                finally:
                    client.close()
        finally:
            with database.transaction() as c:
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s',(identity,))
