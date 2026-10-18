"""Prepare allowlisted local release archives. Never publishes, deploys or includes private inputs."""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parents[1]


def main() -> None:
    output=ROOT/'.local/release'
    output.mkdir(parents=True,exist_ok=True)
    env=dotenv_values(ROOT/'.env.local',interpolate=False)
    private={key:value for key,value in env.items() if value and len(value)>=12 and
        any(word in key.upper() for word in ('SECRET','PASSWORD','CREDENTIAL','SIGNING','SERVICE_ROLE','DATABASE_URL','GROQ_API_KEY','HF_TOKEN'))}
    api=[ROOT/name for name in ('.dockerignore','infra/Dockerfile.api','infra/render-free.yaml',
        'apps/api/requirements.lock','docs/DEPLOYMENT.md','docs/OPERATIONS.md','docs/SETUP.md',
        'docs/ACCOUNT_SETUP.md','.env.example','scripts/migrate.py','models/PROVENANCE.md','models/manifest.json')]
    api+=list((ROOT/'supabase/migrations').glob('*.sql'))
    api+=list((ROOT/'apps/api/app').rglob('*.py'))
    api+=[p for name in ('osm','localization') for p in (ROOT/'data'/name).glob('*') if p.suffix in {'.json','.md'}]
    web=[ROOT/'apps/web'/name for name in ('package.json','package-lock.json','vite.config.ts','index.html','openapi.json',
        'tsconfig.json','tsconfig.app.json','tsconfig.node.json','eslint.config.js')]
    web=[p for p in web if p.is_file()]
    web+=[p for p in (ROOT/'apps/web/src').rglob('*') if p.is_file() and p.suffix in {'.ts','.tsx','.css','.svg'}]
    web+=[p for p in (ROOT/'apps/web/public').rglob('*') if p.is_file()]
    web+=[p for p in (ROOT/'apps/web/scripts').glob('*.mjs') if p.is_file()]
    worker=list((ROOT/'apps/api/app').rglob('*.py'))
    worker+=[ROOT/name for name in ('apps/api/pyproject.toml','apps/api/requirements.lock',
        'apps/api/worker.env.example','models/requirements-text.txt','models/requirements-owned-rtx5050.lock',
        'models/manifest.json','models/PROVENANCE.md','scripts/download_models.py','docs/MODEL_DEPLOYMENT.md')]
    built=[p for p in (ROOT/'apps/web/dist').rglob('*') if p.is_file()]
    if not built:
        raise SystemExit('Build the frontend before packaging')
    reports=[]
    for name,files,base in [('api-source',api,ROOT),('web-source',web,ROOT),('owned-worker-source',worker,ROOT),
                            ('web-static-local-preview',built,ROOT/'apps/web/dist')]:
        digest=hashlib.sha256()
        entries=[]
        for path in sorted(set(files)):
            relative=path.relative_to(base).as_posix()
            if any(part in {'.git','.local','.cache','node_modules','__pycache__'} or
                   (part.startswith('.env') and part != '.env.example') for part in path.relative_to(ROOT).parts):
                raise SystemExit('Disallowed release path: '+relative)
            body=path.read_bytes()
            found=[key for key,value in private.items() if value.encode() in body]
            if found:
                raise SystemExit('Configured private setting found in '+relative+'; values suppressed')
            checksum=hashlib.sha256(body).hexdigest()
            entries.append({'path':relative,'sha256':checksum,'bytes':len(body)})
            digest.update((relative+'\0'+checksum+'\n').encode())
        target=output/(name+'.zip')
        with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for path in sorted(set(files)):
                archive.write(path,path.relative_to(base).as_posix())
        reports.append({'name':name,'path':target.relative_to(ROOT).as_posix(),'files':len(entries),
            'source_tree_sha256':digest.hexdigest(),'archive_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'bytes':target.stat().st_size})
        (output/(name+'-manifest.json')).write_text(json.dumps(entries,indent=2)+'\n')
    report={'scope':'Local allowlisted archives only; no publishing, source/model upload or deployment',
        'artifacts':reports,'configured_private_values_found':False,'original_datasets_included':False,
        'model_weights_included':False,'static_frontend_note':'Local-preview build uses currently configured public origins; rebuild with approved HTTPS API origin before publishing.',
        'publication_approved':False,'deployed':False}
    (ROOT/'evals/reports/release-package.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
