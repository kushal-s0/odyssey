"""Explicit pinned weight provisioning; downloads only, never uploads input data."""
# ruff: noqa: E402 -- bootstrap the repository path and HF transport policy before imports.
import argparse
import hashlib
import json
import logging
import os
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
os.environ['HF_HUB_DISABLE_XET']='1'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS']='1'
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)

from dotenv import dotenv_values
from huggingface_hub import snapshot_download
from app.worker.manifest import MANIFEST, MANIFEST_HASH


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts',nargs='+',choices=['qwen','embedding','indic_en','en_indic'],default=['qwen','embedding'])
    args=parser.parse_args()
    # Read existing configuration in memory; do not create additional token files.
    token=os.environ.get('HF_TOKEN') or dotenv_values(ROOT/'.env.local').get('HF_TOKEN') or dotenv_values(ROOT/'.env').get('HF_TOKEN')
    report=[]
    for name in args.artifacts:
        artifact=MANIFEST[name]
        print('Downloading pinned artifact: '+name,flush=True)
        try:
            folder=Path(snapshot_download(artifact['id'],revision=artifact['revision'],cache_dir=ROOT/'.cache/huggingface/hub',
                token=token,allow_patterns=['*.json','*.safetensors','*.txt','*.model','*.tiktoken','LICENSE*','README.md','*.py'],max_workers=2))
            files=[]
            for path in sorted(folder.rglob('*')):
                if path.is_file():
                    digest=hashlib.sha256()
                    with path.open('rb') as source:
                        for chunk in iter(lambda: source.read(1024*1024),b''):
                            digest.update(chunk)
                    files.append({'path':path.relative_to(folder).as_posix(),'bytes':path.stat().st_size,'sha256':digest.hexdigest()})
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
