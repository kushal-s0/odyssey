"""Real loopback API/PG/model + Edge UI. Synthetic Auth issuer fixture, not Supabase proof."""
# ruff: noqa: E402 -- repository test-fixture bootstrap.
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
import jwt
import uvicorn
from cryptography.hazmat.primitives.asymmetric import rsa

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'apps/api'),str(ROOT/'tests/api')]
from app.auth.jwt import TokenVerifier
from app.config import Settings
from app.db.pool import Database
from app.main import create_app
from test_database import seeded
from test_submissions import pdf,wav


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]


@contextmanager
def server(app,port):
    sock=socket.socket()
    sock.bind(('127.0.0.1',port))
    instance=uvicorn.Server(uvicorn.Config(app,log_level='critical',access_log=False))
    thread=threading.Thread(target=instance.run,kwargs={'sockets':[sock]},daemon=True)
    thread.start()
    deadline=time.monotonic()+15
    while not instance.started:
        if not thread.is_alive() or time.monotonic()>deadline:
            raise RuntimeError('Local browser API did not start')
        time.sleep(.05)
    try:
        yield
    finally:
        instance.should_exit=True
        thread.join(10)
        sock.close()
        assert not thread.is_alive()


def main():
    dsn=(ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(dsn).hostname not in {'127.0.0.1','localhost'}:
        raise SystemExit('This synthetic check is restricted to local PostgreSQL')
    run=uuid4().hex
    directory=(ROOT/'.local'/('applicant-ui-'+run)).resolve()
    assert directory.is_relative_to((ROOT/'.local').resolve())
    directory.mkdir()
    (directory/'synthetic.pdf').write_bytes(pdf(pages=1))
    (directory/'synthetic.wav').write_bytes(wav())
    apiport,webport=free_port(),free_port()
    origin=f'http://127.0.0.1:{apiport}'
    web=f'http://127.0.0.1:{webport}'
    bootstrap='synthetic-browser-worker-'+uuid4().hex
    settings=Settings(_env_file=None,app_env='test',database_url=dsn,storage_backend='local',
        local_storage_dir=directory/'private-originals',cors_origins=[web],public_web_url=web,
        auth_issuer='https://identity.example.test/auth/v1',
        auth_jwks_url='https://identity.example.test/auth/v1/.well-known/jwks.json',
        worker_credential=bootstrap,stage_capability_signing_key='synthetic-browser-signing-'+uuid4().hex,
        max_active_jobs_per_user=5)
    private_key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public.update(kid='browser-fixture-key',alg='RS256',use='sig')
    app=create_app(settings)
    app.state.token_verifier=TokenVerifier(settings,httpx.MockTransport(lambda request:httpx.Response(200,json={'keys':[public]})))
    database=Database(settings)
    database.open()
    children=[]
    identity='applicant-ui-'+run
    try:
        with seeded(database) as data:
            try:
                with database.transaction() as c:
                    c.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s",(data['job'],))
                expires=int(time.time())+3600
                token=jwt.encode({'sub':str(data['people'][0]),'iss':settings.auth_issuer,'aud':'authenticated',
                    'role':'authenticated','exp':expires,'iat':int(time.time())-1},private_key,algorithm='RS256',headers={'kid':'browser-fixture-key'})
                fixture=directory/'session.private.json'
                fixture.write_text(json.dumps({'token':token,'user':str(data['people'][0]),'expires':expires,
                    'directory':str(directory),'origin':origin,'web':web}),encoding='utf-8')
                env={**os.environ,'VITE_API_BASE_URL':origin,'VITE_SUPABASE_URL':'https://identity.example.test',
                    'VITE_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture_only','VITE_FIXTURE_MODE':'true',
                    'APPLICANT_UI_FIXTURE':str(fixture)}
                with server(app,apiport):
                    node=shutil.which('node')
                    if not node:
                        raise RuntimeError('Node is required for the browser check')
                    vite=subprocess.Popen([node,str(ROOT/'apps/web/node_modules/vite/bin/vite.js'),
                        '--host','127.0.0.1','--port',str(webport),'--strictPort'],cwd=ROOT/'apps/web',env=env,
                        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                    children.append(vite)
                    deadline=time.monotonic()+30
                    while time.monotonic()<deadline:
                        try:
                            if httpx.get(web,timeout=2).status_code==200:
                                break
                        except httpx.HTTPError:
                            pass
                        if vite.poll() is not None:
                            raise RuntimeError('Local Vite process failed')
                        time.sleep(.1)
                    worker_env={**os.environ,'WORKER_CREDENTIAL':bootstrap,'PYTHONPATH':str(ROOT/'apps/api')}
                    worker=subprocess.Popen([str(ROOT/'.venv-model/Scripts/python.exe'),'-B','-m','app.worker',
                        '--api',origin,'--allow-loopback','--worker-id',identity,'--handler','app.pipeline.run:handler',
                        '--stages','extract:text','translate','structure','assess','--session-seconds','600',
                        '--stage-seconds','240','--idle-seconds','120'],env=worker_env,
                        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                    children.append(worker)
                    began=time.perf_counter()
                    result=subprocess.run([node,'scripts/browser-applicant.mjs'],cwd=ROOT/'apps/web',env=env,timeout=420,check=False)
                    if result.returncode:
                        raise RuntimeError('Browser check failed; inspect ignored run screenshots/trace and rerun after repair')
                    with database.transaction() as c:
                        rows=c.execute('''SELECT j.status,v.input_kind,a.payload FROM public.submissions s
                            JOIN public.submission_versions v ON v.id=s.current_revision_id
                            JOIN public.processing_jobs j ON j.input_revision_id=v.id
                            LEFT JOIN public.assessments a ON a.input_revision_id=v.id
                            WHERE s.owner_id=%s AND s.id<>%s ORDER BY s.created_at''',
                            (data['people'][0],data['submissions'][0])).fetchall()
                    assert len(rows)==4
                    assert rows[0]['status']=='completed' and rows[0]['payload']
                    assert [row['input_kind'] for row in rows]==['text','pdf','audio','audio']
                    assert all(row['payload'] is None for row in rows[1:])
                    report={'scope':'Actual Edge/API/Postgres/owned model on synthetic inputs; Auth provider responses are fixtures, not hosted Supabase verification',
                        'seconds':round(time.perf_counter()-began,3),'new_submissions':len(rows),
                        'text_assessment_persisted':True,'pdf_and_audio_processing_pending':True,
                        'checks':json.loads((directory/'browser-results.json').read_text()),
                        'human_quality_validated':False,'deployed':False}
                    (ROOT/'evals/reports/applicant-ui.json').write_text(json.dumps(report,indent=2)+'\n')
                    print(json.dumps({key:value for key,value in report.items() if key!='checks'}))
            finally:
                for child in reversed(children):
                    if child.poll() is None:
                        child.terminate()
                    child.wait(timeout=15)
                with database.transaction() as c:
                    c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=%s',(identity,))
                    c.execute('DELETE FROM public.submissions WHERE owner_id=ANY(%s) AND id<>ALL(%s)',(data['people'],data['submissions']))
                    c.execute('DELETE FROM public.attachments WHERE owner_id=ANY(%s) AND submission_id IS NULL',(data['people'],))
                # The token is ephemeral synthetic test identity, never a copied
                # credential. Remove only this uniquely-created test file.
                if (directory/'session.private.json').exists():
                    (directory/'session.private.json').unlink()
    finally:
        database.close()


if __name__=='__main__':
    main()
