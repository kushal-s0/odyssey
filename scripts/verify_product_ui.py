"""Real local API/Postgres/Edge product checks with explicit assessment/Auth fixtures.

This does not assert model quality or live external-provider integration.
"""
# ruff: noqa: E402
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'apps/api'), str(ROOT/'tests/api'), str(ROOT/'scripts')]
from app.auth.jwt import TokenVerifier
from app.config import Settings
from app.contracts.models import EvidenceField, Money
from app.db.pool import Database
from app.main import create_app
from app.providers.osm import OsmUnavailable
import app.routes.location_insights as location_routes
from product_helpers import save_assessment
from test_database import seeded
from test_submissions import wav
from test_similar import index
from verify_applicant_ui import free_port, server


def main():
    dsn = (ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(dsn).hostname not in {'127.0.0.1','localhost'}:
        raise SystemExit('Product UI verification is restricted to the local test database')
    directory = ROOT/'.local'/('product-ui-' + uuid4().hex)
    directory.mkdir(parents=True)
    (directory/'synthetic-followup.wav').write_bytes(wav(1))
    apiport, webport = free_port(), free_port()
    origin, web = f'http://127.0.0.1:{apiport}', f'http://127.0.0.1:{webport}'
    settings = Settings(_env_file=None, app_env='test', database_url=dsn, storage_backend='local',
        local_storage_dir=directory/'originals', cors_origins=[web], public_web_url=web,
        auth_issuer='https://identity.example.test/auth/v1',
        auth_jwks_url='https://identity.example.test/auth/v1/.well-known/jwks.json')
    key = rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid='product-fixture',alg='RS256',use='sig')
    app = create_app(settings)
    def provider_outage(*_):
        raise OsmUnavailable('Explicit local verification fixture; no network lookup')
    location_routes.nearby = provider_outage
    app.state.token_verifier = TokenVerifier(settings,httpx.MockTransport(lambda _:httpx.Response(200,json={'keys':[jwk]})))
    database = Database(settings)
    database.open()
    vite = None
    fixture = directory/'session.private.json'
    try:
        with seeded(database) as data:
            # Private cleanup identities survive a failed UI/cleanup attempt.
            # Never use a name/prefix search to remove other fixtures or users.
            (directory/'cleanup.private.json').write_text(json.dumps({
                'people':[str(value) for value in data['people']],
                'cohorts':[str(value) for value in data['cohorts']],
                'original_storage_path':data['object_path']}),encoding='utf-8')
            original = save_assessment(database,data['submissions'][0],data['revisions'][0])
            other = save_assessment(database,data['submissions'][1],data['revisions'][1])
            index(database,original,[1.] + [0.] * 383)
            index(database,other,[1.] + [0.] * 383)
            # Explicit fixture figures, used to test rendered arithmetic, not to
            # represent a real model extraction or prediction.
            original.evidence[0].english_text = 'Tea for office workers. I sell 120 cups per day for 25 days per month.'
            original.business.unit_price = EvidenceField[Money](value=Money(amount='10',currency='INR',unit='cup'),
                status='present',source_segment_ids=[original.evidence[0].id])
            with database.transaction() as c:
                c.execute('UPDATE public.assessments SET payload=%s WHERE id=%s', (Jsonb(original.model_dump(mode='json')),original.id))
                c.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (data['job'],))
                c.execute('UPDATE public.submissions SET cohort_id=%s WHERE id=%s', (data['cohorts'][0],data['submissions'][1]))
                job=c.execute("INSERT INTO public.processing_jobs(submission_id,input_revision_id,pipeline_version,backend,status) VALUES(%s,%s,'synthetic-ui','owned_worker','completed') RETURNING id", (other.submission_id,other.input_revision_id)).fetchone()
                c.execute("INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash,status) VALUES(%s,'extract:text',0,%s,'completed')",(job['id'],'a'*64))
            expires = int(time.time()) + 3600
            accounts = {}
            for name, person in [('applicant',data['people'][0]),('assessor',data['people'][2]),('second_applicant',data['people'][1])]:
                token = jwt.encode({'sub':str(person),'iss':settings.auth_issuer,'aud':'authenticated',
                    'role':'authenticated','exp':expires,'iat':int(time.time())-1},key,algorithm='RS256',headers={'kid':'product-fixture'})
                accounts[name] = {'token':token,'user':str(person)}
            fixture.write_text(json.dumps({'accounts':accounts,'expires':expires,'origin':origin,'web':web,
                'directory':str(directory),'submission':str(original.submission_id)}),encoding='utf-8')
            env = {**os.environ,'VITE_API_BASE_URL':origin,'VITE_SUPABASE_URL':'https://identity.example.test',
                'VITE_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture_only','VITE_FIXTURE_MODE':'true',
                'PRODUCT_UI_FIXTURE':str(fixture)}
            with server(app,apiport):
                node = shutil.which('node')
                if not node:
                    raise RuntimeError('Node is required')
                vite = subprocess.Popen([node,str(ROOT/'apps/web/node_modules/vite/bin/vite.js'),'--host','127.0.0.1',
                    '--port',str(webport),'--strictPort'],cwd=ROOT/'apps/web',env=env,stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                for _ in range(100):
                    try:
                        if httpx.get(web,timeout=1).status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if vite.poll() is not None:
                        raise RuntimeError('Vite stopped during product verification')
                    time.sleep(.2)
                result = subprocess.run([node,'scripts/browser-product.mjs'],cwd=ROOT/'apps/web',env=env,timeout=180)
                if result.returncode:
                    raise RuntimeError('Product browser check failed; inspect ignored .local/product-ui-* artifacts')
                report = json.loads((directory/'browser-results.json').read_text())
                (ROOT/'evals/reports/product-ui.json').write_text(json.dumps(report,indent=2)+'\n')
                print(json.dumps({'checks':len(report['checks']),'model_quality_validated':False,'deployed':False}))
    finally:
        if vite and vite.poll() is None:
            vite.terminate()
            vite.wait(timeout=15)
        if fixture.exists():
            fixture.unlink()
        database.close()


if __name__ == '__main__':
    main()
