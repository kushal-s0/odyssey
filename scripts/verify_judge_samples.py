"""Verify all generated input files through real isolated local API/storage.

No model/provider calls, no hosted database access, no existing data mutation.
"""
# ruff: noqa: E402
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit
from uuid import uuid4

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'apps/api'), str(ROOT/'tests/api')]
from app.config import Settings
from app.db.pool import Database
from test_submissions import init_upload, submit, workspace


def main():
    url = (ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(url).hostname not in {'localhost', '127.0.0.1'}:
        raise SystemExit('Sample acceptance must use isolated loopback PostgreSQL')
    manifest = json.loads((ROOT/'input/manifest.json').read_text(encoding='utf-8'))
    database = Database(Settings(_env_file=None, app_env='test', database_url=url))
    database.open()
    results = []
    directory = ROOT/'.local'/('judge-sample-acceptance-'+uuid4().hex)
    try:
        with workspace(database,directory) as (client, data, app):
            for item in manifest['artifacts']:
                path = ROOT/'input'/item['path']
                content = path.read_bytes()
                assert hashlib.sha256(content).hexdigest() == item['sha256']
                expected = json.loads((ROOT/'input/expected'/(item['case_id']+'.json')).read_text(encoding='utf-8'))
                payload = {'synthetic': True, 'scenario_family': expected.get('family', item['case_id']),
                           'preferred_language': expected.get('language','en')}
                if item['format'] == 'text':
                    payload['text'] = content.decode('utf-8')
                else:
                    mime = 'application/pdf' if path.suffix == '.pdf' else 'audio/wav'
                    if mime == 'application/pdf':
                        text = ''.join(page.extract_text() for page in PdfReader(path).pages).strip()
                        assert bool(text) == (item['format'] == 'digital_pdf')
                    initiated = init_upload(client,content,mime)
                    upload = client.put(initiated['upload_path'],content=content,headers={'Content-Type':mime})
                    assert upload.status_code == 200, upload.text
                    payload['attachment_ids'] = [initiated['attachment_id']]
                    assert client.get('/v1/uploads/'+initiated['attachment_id']+'/content').content == content
                result = submit(client,payload)
                assert result.status_code == 202, result.text
                accepted = result.json()
                # This harness verifies admission, not model completion. Terminally
                # cancel its own accepted jobs so they cannot be claimed accidentally.
                cancelled = client.post('/v1/jobs/'+accepted['job_id']+'/cancel')
                assert cancelled.status_code == 200 and cancelled.json()['status'] == 'cancelled'
                with database.transaction() as c:
                    row = c.execute('SELECT synthetic,family_id FROM public.submissions WHERE id=%s',
                        (accepted['submission_id'],)).fetchone()
                assert row['synthetic'] and row['family_id'].startswith(f"demo:{data['people'][0]}:")
                results.append({'path': item['path'], 'format': item['format'], 'hash_verified': True,
                    'accepted': True, 'original_intact': True, 'synthetic_metadata_preserved': True})
    finally:
        database.close()
    report = {'scope':'Real local API/PostgreSQL/private storage; synthetic files and test identity; jobs cancelled before inference',
        'cases':results,'passed':len(results)==18,'model_inference_run':False,'human_quality_validated':False,'deployed':False}
    (ROOT/'evals/reports/judge-sample-acceptance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'cases':len(results),'passed':report['passed'],'provider_calls':0,'model_quality_claim':False}))


if __name__ == '__main__':
    main()
