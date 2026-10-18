"""Verify the local non-root API image without hosted credentials or publication."""
import json
import socket
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import httpx

ROOT=Path(__file__).resolve().parents[1]


def docker(*args):
    return subprocess.check_output(['docker',*args],stderr=subprocess.PIPE).decode().strip()


def main():
    image='odyssey-api:local-20261018'
    name='odyssey-image-check-'+uuid4().hex
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
    metadata=json.loads(docker('image','inspect',image))[0]
    assert metadata['Config']['User'] not in {'','root','0'}
    smoke="import os,importlib.util; from app.domain.questions import localizations; from app.config import ROOT; assert os.getuid()!=0; assert len(localizations())==5; assert (ROOT/'data/osm/bengaluru-tea.json').is_file(); assert importlib.util.find_spec('torch') is None; assert not (ROOT/'.env.local').exists(); print('resource checks passed')"
    assert docker('run','--rm',image,'python','-c',smoke)=='resource checks passed'
    docker('run','--detach','--name',name,'--label','odyssey.image-check='+name,'--memory','512m','--cpus','1',
        '-p',f'127.0.0.1:{port}:8000',image)
    began=time.monotonic()
    try:
        deadline=time.monotonic()+40
        while time.monotonic()<deadline:
            try:
                result=httpx.get(f'http://127.0.0.1:{port}/health/live',timeout=2,trust_env=False)
                if result.status_code==200:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(.2)
        else:
            raise RuntimeError('Local image liveness failed')
        schema=httpx.get(f'http://127.0.0.1:{port}/openapi.json',timeout=10,trust_env=False).json()
        assert '/v1/submissions/{submission_id}/clarifications' in schema['paths']
        report={'scope':'Actual local Docker image/runtime, no hosted account/data/credentials',
            'image_id':metadata['Id'],'size_bytes':metadata['Size'],'non_root_user':metadata['Config']['User'],
            'liveness_start_seconds':round(time.monotonic()-began,3),'memory_limit_bytes':512*1024*1024,'cpu_limit':1,
            'localization_and_osm_bundled':True,'gpu_framework_in_image':False,'private_env_in_image':False,
            'hosted_auth_storage_models_validated':False,'deployed':False,'passed':True}
        (ROOT/'evals/reports/api-image.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
    finally:
        labels=json.loads(docker('inspect','--format','{{json .Config.Labels}}',name))
        if labels.get('odyssey.image-check')==name:
            docker('rm','--force',name)


if __name__=='__main__':
    main()
