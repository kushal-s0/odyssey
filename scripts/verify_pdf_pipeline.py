"""Real local PDF verification; run alone because worker admission shares the test DB."""
# ruff: noqa: E402 -- repository and existing isolated verification helpers.
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'apps/api'),str(ROOT/'tests/api')]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from test_pdf_pipeline import text_pdf
from test_submissions import init_upload, submit
from test_worker_http import BOOTSTRAP, worker_workspace
from test_worker_process import http_server
from stop_child import stop_child


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case',choices=['synthetic','hindi-scan'],default='synthetic')
    parser.add_argument('--extract-only',action='store_true')
    parser.add_argument('--interrupt-after-page',type=int,default=0)
    args=parser.parse_args()
    url=(ROOT/'.local/test-database-url').read_text(encoding='utf-8').strip()
    if urlsplit(url).hostname not in {'127.0.0.1','localhost'}:
        raise SystemExit('PDF verification is restricted to the local test database')
    directory=ROOT/'.local'/('pdf-check-'+uuid4().hex)
    directory.mkdir(parents=True)
    source=directory/'source.pdf'
    if args.case=='synthetic':
        content=text_pdf(source)
        preferred='en'
    else:
        inventory=json.loads((ROOT/'.local/inventory-repeat.private.json').read_text(encoding='utf-8'))
        record=next(r for r in inventory['records'] if '/hindi ' in r['entry_path'].lower()
                    and 'accurate answer.pdf' in r['entry_path'].lower())
        with zipfile.ZipFile(ROOT/record['archive_path']) as archive:
            content=archive.read(record['entry_path'])
        source.write_bytes(content)
        preferred='hi'
    database=Database(Settings(_env_file=None,app_env='test',database_url=url))
    database.open()
    report={}
    try:
        with worker_workspace(database,directory/'storage',lease_seconds=90) as (client,data,app,identity):
            upload=init_upload(client,content)
            assert client.put(upload['upload_path'],content=content,headers={'Content-Type':'application/pdf'}).status_code==200
            accepted=submit(client,{'attachment_ids':[upload['attachment_id']],'preferred_language':preferred}).json()
            (directory/'fixture-ids.private.json').write_text(json.dumps({
                'people':[str(x) for x in data['people']], 'cohorts':[str(x) for x in data['cohorts']],
                'worker':identity, 'submission':accepted['submission_id'], 'job':accepted['job_id']}),encoding='utf-8')
            assert client.get('/v1/uploads/'+upload['attachment_id']+'/content').content==content
            with http_server(app.state.settings) as origin, (directory/'worker.log').open('wb') as log:
                env={**os.environ,'WORKER_CREDENTIAL':BOOTSTRAP,'PYTHONPATH':str(ROOT/'apps/api')}
                command=[str(ROOT/'.venv-model/Scripts/python.exe'),'-B','-m','app.worker','--api',origin,
                    '--allow-loopback','--worker-id',identity,'--handler','app.pipeline.run:handler',
                    '--stages','extract:pdf',* ([] if args.extract_only else ['translate','structure','assess']),
                    '--continuous','--stage-seconds','600']
                def launch():
                    return subprocess.Popen(command,env=env,stdout=log,stderr=subprocess.STDOUT,
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                worker=launch()
                began=time.monotonic()
                interrupted=False
                last_page=-1
                checkpoint={}
                try:
                    while time.monotonic()-began<1500:
                        with database.transaction() as c:
                            state=c.execute('''SELECT j.status,j.error_code,st.status AS extraction_status,st.checkpoint,
                                st.lease_generation FROM public.processing_jobs j JOIN public.job_stages st ON st.job_id=j.id
                                WHERE j.id=%s AND st.stage_key='extract:pdf' ''',(accepted['job_id'],)).fetchone()
                        if state['checkpoint'] and 'next_page' in state['checkpoint']:
                            checkpoint=state['checkpoint']
                        page=checkpoint.get('next_page',0)
                        if page!=last_page:
                            print(f'PDF saved pages={page} status={state["extraction_status"]}',flush=True)
                            last_page=page
                        if args.interrupt_after_page and not interrupted and page>=args.interrupt_after_page and state['extraction_status']=='running':
                            stop_child(worker)
                            # Deliberately expire ONLY this synthetic local lease,
                            # so recovery can be verified without a 90-second wait.
                            with database.transaction() as c:
                                c.execute("UPDATE public.job_stages SET lease_until=clock_timestamp()-interval '1 second' WHERE job_id=%s AND status='running'",
                                          (accepted['job_id'],))
                            interrupted=True
                            worker=launch()
                        if (args.extract_only and state['extraction_status']=='completed') or state['status'] in {'completed','failed','needs_review','partial'}:
                            break
                        if worker.poll() is not None:
                            raise RuntimeError('PDF worker stopped; inspect its private log')
                        time.sleep(.2)
                    else:
                        raise RuntimeError('PDF verification exceeded its overall time budget')
                finally:
                    stop_child(worker)
                with database.transaction() as c:
                    row=c.execute('''SELECT p.payload FROM public.stage_publications p JOIN public.job_stages st ON st.id=p.stage_id
                        WHERE st.job_id=%s AND st.stage_key='extract:pdf' ''',(accepted['job_id'],)).fetchone()
                    assessment=c.execute('SELECT payload FROM public.assessments WHERE input_revision_id=%s',
                                         (accepted['revision_id'],)).fetchone()
                evidence=row['payload']['evidence'] if row else []
                (directory/'extraction.private.json').write_text(json.dumps(row['payload'] if row else checkpoint,ensure_ascii=False,indent=2),encoding='utf-8')
                report={'case':args.case,'scope':'Real local API/private storage/HTTP/native model; trusted synthetic operator identity, not hosted Auth',
                    'seconds':round(time.monotonic()-began,3),'source_sha256':hashlib.sha256(content).hexdigest(),
                    'manifest_hash':MANIFEST_HASH,'status':state['status'],'error_code':state['error_code'],
                    'extraction_published':bool(row),'pages_checkpointed':page,
                    'pages_with_text':sorted({e['page'] for e in evidence}),
                    'segments':len(evidence),'methods':sorted({e['extraction_method'] for e in evidence}),
                    'all_ocr_marked_uncertain':all(e['extraction_uncertain'] for e in evidence if e['extraction_method']=='vision_ocr'),
                    'interruption_requested':bool(args.interrupt_after_page),'interruption_exercised':interrupted,
                    'lease_generation':state['lease_generation'],'original_download_intact':True,
                    'assessment_persisted':bool(assessment),'measurements':checkpoint.get('measurements',[]),
                    'human_quality_validated':False,'deployed':False}
                if assessment:
                    report['scores']=assessment['payload']['scores']
                    (directory/'assessment.private.json').write_text(json.dumps(assessment['payload'],ensure_ascii=False,indent=2),encoding='utf-8')
                report['checks_passed']=bool(row) and (not args.interrupt_after_page or (interrupted and state['lease_generation']>=2)) and (args.extract_only or args.case!='synthetic' or bool(assessment and state['status']=='completed'))
    finally:
        database.close()
    path=ROOT/'evals/reports/pdf-pipeline.json'
    previous=json.loads(path.read_text(encoding='utf-8'))['cases'] if path.exists() else []
    merged={r['case']:r for r in previous+[report]}
    path.write_text(json.dumps({'cases':list(merged.values())},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='measurements'}),flush=True)
    if not report['checks_passed']:
        raise SystemExit(1)


if __name__=='__main__':
    main()
