"""Actual owned GPU check of positive, missing and conflicting judge text inputs.

Only loopback test PostgreSQL and synthetic business data. Not population accuracy.
"""
# ruff: noqa: E402
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlsplit
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'apps/api'),str(ROOT/'tests/api')]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from test_submissions import submit
from test_worker_http import BOOTSTRAP, worker_workspace
from test_worker_process import http_server
from stop_child import stop_child


def main():
    url = (ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(url).hostname not in {'127.0.0.1','localhost'}:
        raise SystemExit('Judge inference must use loopback test PostgreSQL')
    directory = ROOT/'.local'/('judge-inference-'+uuid4().hex)
    directory.mkdir(parents=True)
    database = Database(Settings(_env_file=None,app_env='test',database_url=url))
    database.open()
    results = []
    target = ROOT/'evals/reports/judge-inference.json'
    prior = ROOT/'evals/reports/judge-inference-initial-failure.json'
    if target.exists() and not prior.exists():
        prior.write_bytes(target.read_bytes())
    worker = None
    try:
        with worker_workspace(database,directory/'storage',lease_seconds=90) as (client,data,app,identity):
            (directory/'cleanup.private.json').write_text(json.dumps({
                'people':[str(value) for value in data['people']],
                'cohorts':[str(value) for value in data['cohorts']]}),encoding='utf-8')
            with http_server(app.state.settings) as origin, (directory/'worker.log').open('wb') as log:
                environment = {k:v for k,v in os.environ.items() if k.upper() in {
                    'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','CUDA_PATH'}}
                environment.update(WORKER_CREDENTIAL=BOOTSTRAP,PYTHONIOENCODING='utf-8',PYTHONPATH=str(ROOT/'apps/api'))
                worker = subprocess.Popen([str(ROOT/'.venv-model/Scripts/python.exe'),'-B','-m','app.worker',
                    '--api',origin,'--allow-loopback','--worker-id',identity,'--handler','app.pipeline.run:handler',
                    '--stages','extract:text','translate','structure','assess','--continuous','--stage-seconds','600'],
                    env=environment,stdout=log,stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                for case in ['positive-tea-en','negative-incomplete-en','negative-conflicting-en']:
                    began = time.monotonic()
                    accepted = submit(client,{'text':(ROOT/'input/text'/(case+'.txt')).read_text(encoding='utf-8'),
                        'synthetic':True,'scenario_family':case}).json()
                    while time.monotonic()-began < 700:
                        state = client.get('/v1/jobs/'+accepted['job_id']).json()
                        if state['status'] in {'completed','partial','failed','needs_review','cancelled'}:
                            break
                        if worker.poll() is not None:
                            raise RuntimeError('Owned sample worker stopped')
                        time.sleep(.5)
                    row = {'case':case,'seconds':round(time.monotonic()-began,3),'status':state['status'],'passed':False}
                    response = client.get('/v1/submissions/'+accepted['submission_id']+'/assessment')
                    if response.status_code == 200:
                        value = response.json()
                        (directory/(case+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
                        business = value['business']
                        checks = {}
                        if case == 'positive-tea-en':
                            for field, amount in {'investment':'20000','own_funds':'12000','requested_loan':'8000','unit_price':'10','expenses':'22000'}.items():
                                actual = business[field]['value']
                                checks[field+'_preserved'] = bool(actual and actual['amount'] == amount and actual['currency']=='INR')
                            checks['offer_and_customers_present'] = all(business[key]['status']=='present' for key in ('offer','target_customers'))
                        elif case == 'negative-incomplete-en':
                            checks['no_invented_business'] = all(business[key]['value'] is None for key in ('offer','target_customers','unit_price','investment','revenue','profit'))
                            checks['no_ranking'] = not value['scores']['ranking_eligible']
                        else:
                            checks['price_conflict_preserved'] = business['unit_price']['status']=='ambiguous' and business['unit_price']['value'] is None
                            checks['headline_withheld'] = value['scores']['headline_potential'] is None
                            checks['no_ranking'] = not value['scores']['ranking_eligible']
                        row.update(checks=checks,passed=bool(checks) and all(checks.values()),
                            completeness=value['scores']['completeness_percent'],coverage=value['scores']['evidence_coverage'],
                            withheld_reason=value['scores']['withheld_reason'])
                    results.append(row)
                    target.write_text(json.dumps({'scope':'Actual owned GPU and local API/PostgreSQL; three authored synthetic text cases only',
                        'manifest_hash':MANIFEST_HASH,'cases':results,'passed':len(results)==3 and all(r['passed'] for r in results),
                        'human_quality_validated':False,'deployed':False},indent=2)+'\n',encoding='utf-8')
                    print(json.dumps(row),flush=True)
    finally:
        if worker:
            stop_child(worker)
        database.close()
    raise SystemExit(0 if len(results)==3 and all(row['passed'] for row in results) else 1)


if __name__ == '__main__':
    main()
