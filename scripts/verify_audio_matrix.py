"""Actual full-recording regional pipeline checks, sequential and local only.

Keeps source/transcript/assessment private; public report contains counts and timings.
"""
# ruff: noqa: E402
from __future__ import annotations

import hashlib
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlsplit
from uuid import uuid4
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'apps/api'), str(ROOT / 'tests/api')]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from test_submissions import init_upload, submit
from test_worker_http import BOOTSTRAP, worker_workspace
from test_worker_process import http_server
from stop_child import stop_child


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--languages', nargs='+', choices=['hi', 'te', 'bn', 'or'], default=['hi', 'te', 'bn', 'or'])
    args = parser.parse_args()
    url = (ROOT / '.local/test-database-url').read_text().strip()
    if urlsplit(url).hostname not in {'localhost', '127.0.0.1'}:
        raise SystemExit('Audio verification is restricted to the isolated local database')
    public = json.loads((ROOT / 'evals/manifests/dataset.json').read_text(encoding='utf-8'))['records']
    private = {r['id']: r for r in json.loads((ROOT / '.local/dataset-manifest.private.json').read_text(encoding='utf-8'))['records']}
    database = Database(Settings(_env_file=None, app_env='test', database_url=url))
    database.open()
    reports = []
    target = ROOT / 'evals/reports/audio-matrix.json'
    if target.exists() and not (ROOT / 'evals/reports/audio-matrix-initial-failure.json').exists():
        (ROOT / 'evals/reports/audio-matrix-initial-failure.json').write_bytes(target.read_bytes())
    try:
        for language in args.languages:
            record = min((r for r in public if r['format'] != 'pdf' and r['declared_folder_language'] == language),
                         key=lambda r: r['decoded_seconds'])
            location = private[record['id']]
            directory = ROOT / '.local' / ('audio-matrix-' + language + '-' + uuid4().hex)
            directory.mkdir(parents=True)
            with zipfile.ZipFile(ROOT / location['archive_path']) as archive:
                content = archive.read(location['entry_path'])
            assert hashlib.sha256(content).hexdigest() == record['id']
            (directory / ('source.' + record['format'])).write_bytes(content)
            result = {'language_selection': language, 'source_sha256': record['id'],
                      'input_seconds': record['decoded_seconds'], 'human_quality_validated': False}
            started = time.monotonic()
            worker = None
            try:
                with worker_workspace(database, directory / 'storage', lease_seconds=90) as (client, data, app, identity):
                    mime = 'audio/mp4' if record['format'] == 'mp4' else 'audio/ogg'
                    upload = init_upload(client, content, mime)
                    sent = client.put(upload['upload_path'], content=content, headers={'Content-Type': mime})
                    assert sent.status_code == 200, 'Source upload rejected'
                    accepted = submit(client, {'attachment_ids': [upload['attachment_id']], 'preferred_language': language})
                    assert accepted.status_code == 202, 'Audio submission rejected'
                    accepted = accepted.json()
                    assert client.get('/v1/uploads/' + upload['attachment_id'] + '/content').content == content
                    result['original_download_intact'] = True
                    with http_server(app.state.settings) as origin, (directory / 'worker.log').open('wb') as log:
                        command = [str(ROOT / '.venv-model/Scripts/python.exe'), '-B', '-m', 'app.worker',
                            '--api', origin, '--allow-loopback', '--worker-id', identity,
                            '--handler', 'app.pipeline.run:handler', '--stages', 'extract:audio', 'translate', 'structure', 'assess',
                            '--continuous', '--stage-seconds', '600']
                        # Same narrow environment as the native launcher; no DB/Groq/service/signing secrets.
                        environment = {k: v for k, v in os.environ.items() if k.upper() in {
                            'SYSTEMROOT', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'CUDA_PATH'}}
                        environment.update(WORKER_CREDENTIAL=BOOTSTRAP, PYTHONPATH=str(ROOT / 'apps/api'), PYTHONIOENCODING='utf-8')
                        def launch():
                            return subprocess.Popen(command, env=environment, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
                        worker = launch()
                        interrupted = False
                        last_chunk = -1
                        while time.monotonic() - started < 1200:
                            with database.transaction() as connection:
                                state = connection.execute('''SELECT j.status,j.error_code,st.status AS extraction_status,
                                    st.checkpoint,st.lease_generation FROM public.processing_jobs j
                                    JOIN public.job_stages st ON st.job_id=j.id
                                    WHERE j.id=%s AND st.stage_key='extract:audio' ''', (accepted['job_id'],)).fetchone()
                            checkpoint = state['checkpoint'] or {}
                            count = checkpoint.get('completed_chunks', 0)
                            if count != last_chunk:
                                print(json.dumps({'language': language, 'saved_chunks': count, 'status': state['status']}), flush=True)
                                last_chunk = count
                            if language == 'hi' and not interrupted and count >= 1 and state['extraction_status'] == 'running':
                                stop_child(worker)
                                with database.transaction() as connection:
                                    connection.execute("UPDATE public.job_stages SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=%s AND status='running'", (accepted['job_id'],))
                                interrupted = True
                                worker = launch()
                            if state['status'] in {'completed', 'partial', 'failed', 'needs_review', 'cancelled'}:
                                break
                            if worker.poll() is not None:
                                raise RuntimeError('Owned audio worker stopped')
                            time.sleep(.5)
                        else:
                            raise TimeoutError('Full audio pipeline exceeded verification budget')
                        stop_child(worker)
                        worker = None
                    with database.transaction() as connection:
                        stages = connection.execute('''SELECT st.stage_key,st.status,st.error_code,st.checkpoint,p.payload
                            FROM public.job_stages st LEFT JOIN public.stage_publications p ON p.stage_id=st.id
                            WHERE st.job_id=%s ORDER BY st.stage_order''', (accepted['job_id'],)).fetchall()
                        extraction = connection.execute('''SELECT p.payload FROM public.stage_publications p
                            JOIN public.job_stages st ON st.id=p.stage_id WHERE st.job_id=%s AND st.stage_key='extract:audio' ''',
                            (accepted['job_id'],)).fetchone()
                    (directory / 'stages.private.json').write_text(json.dumps(stages, ensure_ascii=False, indent=2), encoding='utf-8')
                    result['stages'] = [{'stage': s['stage_key'], 'status': s['status'], 'error_code': s['error_code']} for s in stages]
                    if extraction:
                        (directory / 'extraction.private.json').write_text(json.dumps(extraction['payload'], ensure_ascii=False, indent=2), encoding='utf-8')
                    assessment = client.get('/v1/submissions/' + accepted['submission_id'] + '/assessment')
                    value = assessment.json() if assessment.status_code == 200 else None
                    if value:
                        (directory / 'assessment.private.json').write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
                    evidence = extraction['payload']['evidence'] if extraction else []
                    result.update(status=state['status'], error_code=state['error_code'], extraction_published=bool(extraction),
                        segments=len(evidence), all_transcripts_uncertain=all(e['transcription_uncertain'] for e in evidence),
                        interruption_exercised=interrupted, lease_generation=state['lease_generation'],
                        assessment_persisted=bool(value), withheld_reason=value['scores']['withheld_reason'] if value else None)
                    result['functional_passed'] = bool(value and evidence and state['status'] in {'completed', 'partial'}
                        and value['scores']['withheld_reason'] == 'source_requires_review'
                        and (language != 'hi' or interrupted and state['lease_generation'] >= 2))
            except Exception as error:
                import traceback
                (directory / 'error.private.txt').write_text(traceback.format_exc(), encoding='utf-8')
                result.update(functional_passed=False, error_type=type(error).__name__)
            finally:
                if worker:
                    stop_child(worker)
            result['seconds'] = round(time.monotonic() - started, 3)
            reports.append(result)
            report = {'scope': 'Actual full organizer recordings, owned models/local API/PostgreSQL; synthetic operator identity',
                'manifest_hash': MANIFEST_HASH, 'requested_languages': args.languages,
                'cases': reports, 'passed': len(reports) == len(args.languages) and all(r['functional_passed'] for r in reports),
                'human_quality_validated': False, 'deployed': False}
            (ROOT / 'evals/reports/audio-matrix.json').write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(result), flush=True)
    finally:
        database.close()
    if not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
