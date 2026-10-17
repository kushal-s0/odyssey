"""Explicit pinned weight provisioning; downloads only, never uploads input data."""
# ruff: noqa: E402 -- bootstrap the repository path and HF transport policy before imports.
import argparse
import hashlib
import concurrent.futures
import json
import logging
import os
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
os.environ['HF_HUB_DISABLE_XET']='1'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS']='1'
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)

from dotenv import dotenv_values
import httpx
import truststore
from app.worker.manifest import MANIFEST, MANIFEST_HASH

truststore.inject_into_ssl()


def checksum(path,kind='sha256'):
    digest=hashlib.new(kind)
    if kind=='sha1':
        digest.update(('blob '+str(path.stat().st_size)+'\0').encode())
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()


def provision(client,artifact,token):
    headers={'Authorization':'Bearer '+token} if token else {}
    endpoint=f"https://huggingface.co/api/models/{artifact['id']}/revision/{artifact['revision']}"
    metadata=client.get(endpoint,params={'blobs':'true'},headers=headers)
    metadata.raise_for_status()
    folder=ROOT/'.cache/huggingface/hub'/('models--'+artifact['id'].replace('/','--'))/'snapshots'/artifact['revision']
    folder.mkdir(parents=True,exist_ok=True)
    files=[]
    for entry in metadata.json()['siblings']:
        name=entry['rfilename']
        if '/' in name or '\\' in name or name.startswith('.') or not (
                Path(name).suffix in {'.json','.safetensors','.txt','.model','.tiktoken','.py'} or name.startswith('LICENSE') or name=='README.md'):
            continue
        target=folder/name
        size=int(entry['size'])
        lfs=entry.get('lfs') or {}
        expected=lfs.get('sha256') or entry['blobId']
        kind='sha256' if lfs else 'sha1'
        if not target.exists() or target.stat().st_size!=size or checksum(target,kind)!=expected:
            url=f"https://huggingface.co/{artifact['id']}/resolve/{artifact['revision']}/{name}"
            parts=ROOT/'.cache/model-download-parts'/artifact['revision']/name
            parts.mkdir(parents=True,exist_ok=True)
            width=16*1024*1024
            count=max(1,(size+width-1)//width)
            def fetch(index):
                start=index*width
                stop=min(size,start+width)-1
                path=parts/str(index)
                if path.exists() and path.stat().st_size==stop-start+1:
                    return
                for attempt in range(3):
                    try:
                        ranged=size>width
                        request_headers={**headers,**({'Range':f'bytes={start}-{stop}'} if ranged else {})}
                        with client.stream('GET',url,params={'download':'true','part':index},headers=request_headers) as response:
                            response.raise_for_status()
                            if ranged and response.headers.get('content-range')!=f'bytes {start}-{stop}/{size}':
                                raise ValueError('Unexpected artifact range')
                            with path.open('wb') as output:
                                for block in response.iter_bytes(1024*1024):
                                    output.write(block)
                        if path.stat().st_size!=stop-start+1:
                            raise ValueError('Truncated artifact range')
                        return
                    except Exception:
                        if attempt==2:
                            raise
                        time.sleep(attempt+1)
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(fetch,range(count)))
            temporary=target.with_name(target.name+'.download')
            with temporary.open('wb') as output:
                for index in range(count):
                    with (parts/str(index)).open('rb') as source:
                        for block in iter(lambda:source.read(1024*1024),b''):
                            output.write(block)
            if checksum(temporary,kind)!=expected:
                raise ValueError('Upstream artifact checksum mismatch')
            os.replace(temporary,target)
        files.append({'path':name,'bytes':size,'sha256':checksum(target)})
    return files


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts',nargs='+',choices=['qwen','embedding','ocr','indic_en','en_indic'],default=['qwen','embedding'])
    args=parser.parse_args()
    # Read existing configuration in memory; do not create additional token files.
    token=os.environ.get('HF_TOKEN') or dotenv_values(ROOT/'.env.local').get('HF_TOKEN') or dotenv_values(ROOT/'.env').get('HF_TOKEN')
    report=[]
    for name in args.artifacts:
        artifact=MANIFEST[name]
        print('Downloading pinned artifact: '+name,flush=True)
        try:
            with httpx.Client(timeout=60,follow_redirects=True,trust_env=False) as client:
                # Public artifacts do not depend on an optional gated-model token being valid.
                files=provision(client,artifact,None if name in {'qwen','embedding','ocr'} else token)
            report.append({'artifact':name,**artifact,'files':files})
            print('Pinned artifact cached and hashed: '+name,flush=True)
        except Exception as error:
            print('Artifact download failed: '+name+' ('+type(error).__name__+'); provider details suppressed.',flush=True)
            raise SystemExit(1) from None
    path=ROOT/'evals/reports/feasibility/pinned-downloads.json'
    previous=json.loads(path.read_text())['artifacts'] if path.exists() else []
    combined={item['artifact']:item for item in previous+report}
    path.write_text(json.dumps({'manifest_hash':MANIFEST_HASH,'artifacts':list(combined.values()),
        'scope':'Cached artifacts and checksums only; inference, quality and deployment are separate.'},indent=2)+'\n')


if __name__=='__main__':
    main()
