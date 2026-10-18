"""Actual owned-model text/audio clarification check, isolated local DB and synthetic speech."""
# ruff: noqa: E402
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'apps/api'),str(ROOT/'tests/api')]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from test_submissions import init_upload, submit
from test_worker_http import BOOTSTRAP, worker_workspace
from test_worker_process import http_server
from stop_child import stop_child


def main():
    url=(ROOT/'.local/test-database-url').read_text().strip()
    if urlsplit(url).hostname not in {'localhost','127.0.0.1'}:
        raise SystemExit('Owned verification must use local isolated PostgreSQL')
    directory=ROOT/'.local'/('followup-'+uuid4().hex);directory.mkdir(parents=True)
    audio=directory/'synthetic.wav'
    # Windows' installed voice generates an invented business answer locally;
    # no organizer recording, external speech API or ground-truth WER claim.
    speech_script=directory/'speech.ps1'
    speech_script.write_text("$voice=New-Object -ComObject SAPI.SpVoice\n$file=New-Object -ComObject SAPI.SpFileStream\n$file.Open($args[0],3)\n$voice.AudioOutputStream=$file\n$voice.Speak('My startup investment is twenty thousand rupees. I sell tea to office workers. My business is near the central bus station in Bengaluru.') | Out-Null\n$file.Close()\n",encoding='utf-8')
    subprocess.run(['powershell.exe','-NoProfile','-File',str(speech_script),str(audio)],check=True,stdout=subprocess.DEVNULL)
    database=Database(Settings(_env_file=None,app_env='test',database_url=url));database.open()
    cases=[]
    worker=None
    try:
        with worker_workspace(database,directory/'storage',lease_seconds=90) as (client,data,app,identity):
            with http_server(app.state.settings) as origin,(directory/'worker.log').open('wb') as log:
                worker=subprocess.Popen([str(ROOT/'.venv-model/Scripts/python.exe'),'-B','-m','app.worker',
                    '--api',origin,'--allow-loopback','--worker-id',identity,'--handler','app.pipeline.run:handler',
                    '--stages','extract:text','extract:audio','translate','structure','assess','--continuous','--stage-seconds','600'],
                    env={**os.environ,'WORKER_CREDENTIAL':BOOTSTRAP},stdout=log,stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                def wait(accepted,label):
                    began=time.monotonic()
                    while time.monotonic()-began<900:
                        state=client.get('/v1/jobs/'+accepted['job_id']).json()
                        if state['status'] in {'completed','partial','failed','needs_review','cancelled'}:
                            break
                        if worker.poll() is not None:
                            raise RuntimeError('Owned verification worker stopped')
                        time.sleep(.5)
                    if state['status'] not in {'completed','partial'}:
                        raise RuntimeError('Owned '+label+' ended with '+state['status'])
                    result=client.get('/v1/submissions/'+accepted['submission_id']+'/assessment')
                    assert result.status_code==200
                    value=result.json()
                    (directory/(label+'.private.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
                    cases.append({'case':label,'seconds':round(time.monotonic()-began,3),'status':state['status'],
                        'evidence_count':len(value['evidence']),'completeness_percent':value['scores']['completeness_percent'],
                        'evidence_coverage':value['scores']['evidence_coverage'],'potential':value['scores']['headline_potential'],
                        'withheld_reason':value['scores']['withheld_reason']})
                    print(json.dumps(cases[-1]),flush=True)
                    (ROOT/'evals/reports/followup-pipeline.json').write_text(json.dumps({
                        'scope':'Actual owned-model local follow-up check; synthetic business/voice',
                        'cases':cases,'passed':False,'human_quality_validated':False,'deployed':False},indent=2)+'\n')
                    return value
                first=submit(client,{'text':'I sell tea to office workers. Tea costs INR 10 per cup.'}).json()
                baseline=wait(first,'baseline')
                path='/v1/submissions/'+first['submission_id']
                questions=client.get(path+'/questions').json()
                assert any(q['field']=='investment' for q in questions)
                typed=client.post(path+'/clarifications',headers={'Idempotency-Key':str(uuid4())},json={
                    'expected_revision_id':first['revision_id'],'answers':{'investment':'My startup investment is INR 20000.'},'answer_language':'en'})
                assert typed.status_code==202,typed.text
                updated=wait(typed.json(),'typed-followup')
                assert updated['business']['investment']['value']['amount']=='20000'
                assert updated['business']['offer']['status']=='present'
                assert any(e['origin_revision_id']==first['revision_id'] for e in updated['evidence'])
                assert client.get(path+'/assessment?version=1').json()==baseline
                blob=audio.read_bytes();upload=init_upload(client,blob,'audio/wav')
                assert client.put(upload['upload_path'],content=blob,headers={'Content-Type':'audio/wav'}).status_code==200
                fields=[q['field'] for q in client.get(path+'/questions').json()]
                spoken=client.post(path+'/clarifications',headers={'Idempotency-Key':str(uuid4())},json={
                    'expected_revision_id':typed.json()['revision_id'],'audio_attachment_id':upload['attachment_id'],
                    'audio_fields':fields,'answer_language':'en'})
                assert spoken.status_code==202,spoken.text
                final=wait(spoken.json(),'audio-followup')
                assert any(e['kind']=='audio' and e['transcription_uncertain'] for e in final['evidence'])
                assert final['scores']['withheld_reason']=='source_requires_review'
                assert final['business']['offer']['status']=='present'
                assert client.get(path+'/assessment?version=2').json()==updated
                assert client.get('/v1/uploads/'+upload['attachment_id']+'/content').content==blob
                assert len(client.get(path+'/history').json())==3
                report={'scope':'Actual owned GPU text/ASR/translation/extraction/ratings through local API/PostgreSQL; synthetic applicant identity, business and SAPI audio',
                    'manifest_hash':MANIFEST_HASH,'cases':cases,'passed':True,'history_intact':True,
                    'human_quality_validated':False,'deployed':False}
                (ROOT/'evals/reports/followup-pipeline.json').write_text(json.dumps(report,indent=2)+'\n')
    finally:
        if worker:
            stop_child(worker)
        database.close()


if __name__=='__main__':
    main()
