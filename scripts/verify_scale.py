"""Bounded local-only replication/load/recovery measurement. No public service requests."""
# ruff: noqa: E402
import argparse
import asyncio
import hashlib
import json
import os
import platform
import subprocess
import sys
import time
from contextlib import ExitStack
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from psycopg.types.json import Jsonb

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'apps/api'),str(ROOT/'tests/api'),str(ROOT/'scripts')]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from product_helpers import save_assessment
from test_database import seeded
from verify_applicant_ui import free_port
from stop_child import stop_child


def percentile(values,p):
    return round(sorted(values)[min(len(values)-1,int((len(values)-1)*p))],3) if values else None


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds',type=int,default=300)
    parser.add_argument('--rows',type=int,default=10000)
    parser.add_argument('--users',type=int,default=50)
    parser.add_argument('--pace-seconds',type=float,default=3,help='Initial app polling interval; one-second burst diagnostics are recorded separately')
    parser.add_argument('--skip-recovery',action='store_true',help='Diagnostic load only; final acceptance must include recovery')
    args=parser.parse_args()
    if not 5<=args.seconds<=600 or not 100<=args.rows<=10000 or not 1<=args.users<=50 or not 1<=args.pace_seconds<=30:
        raise SystemExit('Use5–600 seconds,100–10000 rows and1–50 virtual users')
    dsn=(ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(dsn).hostname not in {'localhost','127.0.0.1'}:
        raise SystemExit('Scale checks must never target public databases')
    directory=ROOT/'.local'/('scale-'+uuid4().hex);directory.mkdir(parents=True)
    settings=Settings(_env_file=None,app_env='test',database_url=dsn,worker_credential='synthetic-scale-'+uuid4().hex,
        stage_capability_signing_key='synthetic-stage-'+uuid4().hex,database_pool_max=3,max_model_concurrency=2,max_queue_depth=100,
        max_active_jobs_per_user=20,auth_issuer='https://scale.example.test',auth_jwks_url='https://scale.example.test/jwks')
    db=Database(settings);db.open()
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()));jwk.update(kid='scale',alg='RS256',use='sig')
    workers=[];created=[];replicas=[];report={}
    try:
        with seeded(db) as data,ExitStack() as stack:
            baseline=save_assessment(db,data['submissions'][0],data['revisions'][0])
            family='scale-'+uuid4().hex
            with db.transaction() as c:
                c.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s",(data['job'],))
                created=[r['id'] for r in c.execute('''INSERT INTO public.submissions(owner_id,cohort_id,synthetic,family_id)
                    SELECT %s,%s,true,%s||n::text FROM generate_series(1,%s) n RETURNING id''',
                    (data['people'][0],data['cohorts'][0],family,args.rows)).fetchall()]
                c.execute('''INSERT INTO public.submission_versions(submission_id,revision_number,input_kind,source_text,input_hash,preferred_language,created_by)
                    SELECT id,1,'text','Synthetic metadata fixture only',%s,'en',owner_id FROM public.submissions WHERE id=ANY(%s)''',('a'*64,created))
                c.execute('''UPDATE public.submissions s SET current_revision_id=v.id FROM public.submission_versions v
                    WHERE v.submission_id=s.id AND s.id=ANY(%s)''',(created,))
                rows=c.execute('''INSERT INTO public.processing_jobs(submission_id,input_revision_id,pipeline_version,backend,status)
                    SELECT id,current_revision_id,'scale-fixture-v1','owned_worker','completed' FROM public.submissions WHERE id=ANY(%s)
                    RETURNING id,submission_id,input_revision_id''',(created,)).fetchall()
                c.execute('''INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash,status)
                    SELECT id,'scale:fixture',0,%s,'completed' FROM public.processing_jobs WHERE submission_id=ANY(%s)''',('a'*64,created))
                # Analytics uses stored numeric metadata/domains; these are
                # explicitly synthetic fixtures, not real model assessments.
                c.execute('''INSERT INTO public.assessments(submission_id,input_revision_id,pipeline_version,version,rubric_version,
                    model_manifest_hash,payload,potential,evidence_coverage,completeness_percent,ranking_eligible,trade,sector)
                    SELECT id,current_revision_id,'scale-fixture-v1',1,'rubric-v1',%s,%s,50,.5,50,false,'tea_stall','food_beverage'
                    FROM public.submissions WHERE id=ANY(%s)''',(MANIFEST_HASH,Jsonb(baseline.model_dump(mode='json')),created))
                plan=c.execute('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM public.submissions WHERE owner_id=%s AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 20',
                               (data['people'][0],)).fetchone()
                (directory/'query-plan.json').write_text(json.dumps(plan,default=str,indent=2))
            def clean_records():
                with db.transaction() as c:
                    c.execute("SET LOCAL statement_timeout='120s'")
                    for start in range(0,len(created),100):
                        c.execute('DELETE FROM public.submissions WHERE id=ANY(%s::uuid[])',([str(x) for x in created[start:start+100]],))
            (directory/'fixture-ids.private.json').write_text(json.dumps({'created':[str(x) for x in created], 'people':[str(x) for x in data['people']], 'cohorts':[str(x) for x in data['cohorts']]},indent=2))
            stack.callback(clean_records)
            with db.transaction() as c:
                c.execute('ANALYZE public.submissions,public.submission_versions,public.processing_jobs,public.job_stages,public.assessments')
            replica_config=directory/'replica.private.json'
            replica_config.write_text(json.dumps({'jwk':jwk,'settings':{
                'app_env':'test','database_url':dsn,'database_pool_max':settings.database_pool_max,
                'worker_credential':settings.worker_credential.get_secret_value(),
                'stage_capability_signing_key':settings.stage_capability_signing_key.get_secret_value(),
                'max_model_concurrency':2,'max_queue_depth':100,'max_active_jobs_per_user':20,
                'auth_issuer':settings.auth_issuer,'auth_jwks_url':settings.auth_jwks_url}}))
            for n in range(2):
                port=free_port()
                log=(directory/('api-'+str(n)+'.log')).open('wb');stack.callback(log.close)
                process=subprocess.Popen([sys.executable,'-B',str(ROOT/'scripts/serve_scale_api.py'),str(replica_config),str(port)],
                    stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                stack.callback(stop_child,process)
                endpoint=f'http://127.0.0.1:{port}'
                deadline=time.monotonic()+30
                while time.monotonic()<deadline:
                    try:
                        if httpx.get(endpoint+'/health/live',timeout=1,trust_env=False).status_code==200:
                            break
                    except httpx.HTTPError:
                        pass
                    if process.poll() is not None:
                        raise RuntimeError('Local scale API stopped; inspect ignored API log')
                    time.sleep(.1)
                else:
                    raise RuntimeError('Local scale API startup timed out')
                replicas.append(endpoint)
            proxy_port=free_port();origin=f'http://127.0.0.1:{proxy_port}'
            proxy_log=(directory/'proxy.log').open('wb');stack.callback(proxy_log.close)
            proxy_process=subprocess.Popen(['node',str(ROOT/'scripts/scale_proxy.mjs'),str(proxy_port),*replicas],
                stdout=proxy_log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            stack.callback(stop_child,proxy_process)
            deadline=time.monotonic()+20
            while time.monotonic()<deadline:
                try:
                    if httpx.get(origin+'/health/live',timeout=1,trust_env=False).status_code==200:
                        break
                except httpx.HTTPError:
                    pass
                if proxy_process.poll() is not None:
                    raise RuntimeError('Local streaming proxy stopped')
                time.sleep(.1)
            else:
                raise RuntimeError('Local streaming proxy startup timed out')
            token=jwt.encode({'sub':str(data['people'][0]),'iss':settings.auth_issuer,'aud':'authenticated',
                'role':'authenticated','exp':int(time.time())+3600,'iat':int(time.time())-1},key,algorithm='RS256',headers={'kid':'scale'})
            headers={'Authorization':'Bearer '+token}
            with httpx.Client(timeout=20,trust_env=False) as client:
                # Write through one replica, then read from the other.
                write_response=client.post(origin+'/v1/submissions',headers={**headers,'Idempotency-Key':str(uuid4())},
                    json={'text':'Synthetic scale recovery job','consent':True})
                assert write_response.status_code==202, 'Cross-replica write failed: '+str(write_response.status_code)
                accepted=write_response.json()
                assert client.get(origin+'/v1/submissions/'+accepted['submission_id'],headers=headers).status_code==200
                created.append(accepted['submission_id'])
            latencies=[];errors=[];by_route={};seen=set()
            paths=['/v1/submissions?limit=20&offset=0']*8+['/v1/submissions/'+str(rows[0]['submission_id'])]*5+[
                '/v1/jobs/'+str(rows[0]['id'])]*6+['/v1/analytics?include_synthetic=true']
            with httpx.Client(timeout=30,trust_env=False) as probe:
                for path in dict.fromkeys(paths):
                    started=time.perf_counter();checked=probe.get(origin+path,headers=headers)
                    print(json.dumps({'phase':'sequential','route':path.split('?')[0].split('/')[2],'status':checked.status_code,'milliseconds':round((time.perf_counter()-started)*1000,3)}),flush=True)
            async def load():
                began=time.monotonic()
                async with httpx.AsyncClient(timeout=20,trust_env=False,limits=httpx.Limits(max_connections=100,max_keepalive_connections=100)) as client:
                    async def user(index):
                        await asyncio.sleep(index/args.users*args.pace_seconds)
                        iteration=index
                        while time.monotonic()-began<args.seconds:
                            path=paths[iteration%len(paths)];kind=path.split('?')[0].split('/')[2]
                            start=time.perf_counter()
                            try:
                                response=await client.get(origin+path,headers=headers)
                                if response.status_code!=200:
                                    errors.append({'status':response.status_code,'route':kind})
                                seen.add(response.headers.get('X-Replica'))
                            except httpx.HTTPError as error:
                                errors.append({'error_type':type(error).__name__,'route':kind})
                            elapsed=(time.perf_counter()-start)*1000
                            latencies.append(elapsed);by_route.setdefault(kind,[]).append(elapsed)
                            iteration+=1
                            await asyncio.sleep(max(0,args.pace_seconds-(time.perf_counter()-start)))
                    await asyncio.gather(*(user(i) for i in range(args.users)))
                return time.monotonic()-began
            elapsed=asyncio.run(load())
            print(json.dumps({'phase':'load','requests':len(latencies),'p95_ms':percentile(latencies,.95),'errors':len(errors)}),flush=True)
            if args.skip_recovery:
                report={'scope':'Diagnostic owned loopback load only; recovery deliberately not rerun',
                    'rows':args.rows,'virtual_users':args.users,'requested_seconds':args.seconds,'elapsed_seconds':round(elapsed,3),
                    'requests':len(latencies),'p50_ms':percentile(latencies,.5),'p95_ms':percentile(latencies,.95),
                    'error_count':len(errors),'route_p95_ms':{k:percentile(v,.95) for k,v in by_route.items()},
                    'pace_seconds_per_user':args.pace_seconds,'public_services_called':False,'replicas_seen':sorted(seen),'recovery_rerun':False,
                    'passed':percentile(latencies,.95)<500 and len(errors)/max(1,len(latencies))<.01}
                (ROOT/'evals/reports/scale-load-diagnostic.json').write_text(json.dumps(report,indent=2)+'\n')
                return
            #20 synthetic one-stage jobs; native workers use outbound HTTP only.
            with db.transaction() as c:
                recovery_rows=rows[:19]+[{'id':accepted['job_id'],'submission_id':accepted['submission_id']}]
                ids=[str(row['id']) for row in recovery_rows]
                digest=hashlib.sha256(b'Synthetic scale orchestration only').hexdigest()
                c.execute('''UPDATE public.submission_versions SET source_text='Synthetic scale orchestration only',input_hash=%s
                    WHERE id IN (SELECT input_revision_id FROM public.processing_jobs WHERE id=ANY(%s::uuid[]))''',(digest,ids))
                c.execute("UPDATE public.processing_jobs SET pipeline_version='scale-fixture-v1',status='queued' WHERE id=ANY(%s::uuid[])",(ids,))
                c.execute('DELETE FROM public.job_stages WHERE job_id=ANY(%s::uuid[])',(ids,))
                c.execute("INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash) SELECT id,'scale:fixture',0,%s FROM public.processing_jobs WHERE id=ANY(%s::uuid[])",(digest,ids))
            def start_worker(n):
                identity='scale-worker-'+family+'-'+str(n)
                env={**os.environ,'WORKER_CREDENTIAL':settings.worker_credential.get_secret_value(),
                    'PYTHONPATH':str(ROOT/'tests/fixtures')}
                stream=(directory/('worker-'+str(n)+'.log')).open('wb');stack.callback(stream.close)
                p=subprocess.Popen([sys.executable,'-B','-m','app.worker','--api',origin,'--allow-loopback','--worker-id',identity,
                    '--handler','scale_handler:run','--stages','scale:fixture','--continuous','--stage-seconds','30'],
                    env=env,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                workers.append(p);stack.callback(stop_child,p);return p,identity
            first,identity=start_worker(1);second,identity2=start_worker(2)
            interrupted=False;began=time.monotonic();expired=[]
            while time.monotonic()-began<240:
                with db.transaction() as c:
                    checkpoint=c.execute("SELECT id FROM public.job_stages WHERE lease_owner=%s AND checkpoint IS NOT NULL AND status='running'",(identity,)).fetchone()
                    if checkpoint and not interrupted:
                        stop_child(first);interrupted=True;expired.append(checkpoint['id'])
                        c.execute("UPDATE public.job_stages SET lease_until=clock_timestamp()-interval '1 second' WHERE id=%s",(checkpoint['id'],))
                    remaining=c.execute("SELECT count(*) AS n FROM public.processing_jobs WHERE id=ANY(%s::uuid[]) AND status<>'completed'",(ids,)).fetchone()['n']
                if remaining==0:
                    break
                time.sleep(.1)
            for process in workers:
                stop_child(process)
            with db.transaction() as c:
                counts=c.execute('''SELECT count(*) AS publications,count(DISTINCT p.stage_id) AS unique_stages
                    FROM public.stage_publications p JOIN public.job_stages st ON st.id=p.stage_id WHERE st.job_id=ANY(%s::uuid[])''',(ids,)).fetchone()
                recovered=c.execute('SELECT max(lease_generation) AS generation FROM public.job_stages WHERE id=ANY(%s)',(expired,)).fetchone()['generation']
                c.execute('DELETE FROM public.worker_runtimes WHERE worker_id=ANY(%s)',([identity,identity2],))
            report={'scope':'Owned loopback only; two independent native FastAPI processes, separate streaming Node round-robin proxy and two native worker processes; synthetic Auth issuer/business metadata/handlers',
                'rows':args.rows,'virtual_users':args.users,'requested_seconds':args.seconds,'elapsed_seconds':round(elapsed,3),
                'pace_seconds_per_user':args.pace_seconds,'ramp_seconds':args.pace_seconds,'sticky_sessions':False,'requests':len(latencies),'p50_ms':percentile(latencies,.5),
                'p95_ms':percentile(latencies,.95),'error_count':len(errors),'unexpected_error_percent':round(len(errors)/max(1,len(latencies))*100,3),
                'route_p95_ms':{k:percentile(v,.95) for k,v in by_route.items()},'replicas_seen':sorted(seen),
                'recovery':{'jobs':20,'remaining':remaining,'interrupted_after_checkpoint':interrupted,
                    'lease_expiry':'Explicitly injected only for one synthetic local stage after worker termination',
                    'recovered_generation':recovered,**counts},'cpu_logical_count':os.cpu_count(),'platform':platform.platform(),
                'api_pool_max_each':settings.database_pool_max,'model_inference':False,'public_services_called':False,
                'target_p95_below_500ms':percentile(latencies,.95)<500,'target_errors_below_one_percent':len(errors)/max(1,len(latencies))<.01,
                'orchestration_passed':remaining==0 and counts['publications']==counts['unique_stages']==20 and interrupted and recovered>=2 and seen=={'0','1'}}
            report['passed']=report['orchestration_passed'] and report['target_p95_below_500ms'] and report['target_errors_below_one_percent']
            target=ROOT/'evals/reports'/('scale-preflight.json' if args.seconds<300 else 'scale.json')
            target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
    finally:
        for process in workers:
            stop_child(process)
        if created:
            with db.transaction() as c:
                c.execute('DELETE FROM public.submissions WHERE id=ANY(%s::uuid[])',([str(x) for x in created],))
        db.close()


if __name__=='__main__':
    main()
