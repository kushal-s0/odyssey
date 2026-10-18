"""Scan changed or staged files for configured private values, without printing them."""
import argparse
import json
from pathlib import Path
import subprocess

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args],cwd=ROOT,stderr=subprocess.DEVNULL)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--staged',action='store_true')
    args = parser.parse_args()
    settings = dotenv_values(ROOT/'.env.local',interpolate=False)
    values = {name:value.encode() for name,value in settings.items() if value and len(value)>=12 and any(
        word in name.upper() for word in ('SECRET','PASSWORD','CREDENTIAL','SIGNING','SERVICE_ROLE','DATABASE_URL','GROQ_API_KEY','HF_TOKEN'))}
    raw = git('diff','--cached' if args.staged else 'HEAD','--name-only','--diff-filter=ACMR','-z')
    if not args.staged:
        raw += git('ls-files','--others','--exclude-standard','-z')
    paths = {path.decode('utf-8') for path in raw.split(b'\0') if path}
    findings = []
    for path in sorted(paths):
        body = git('show',':'+path) if args.staged else (ROOT/path).read_bytes()
        found = [name for name,value in values.items() if value in body]
        if found:
            findings.append({'path':path,'setting_names':found})
    report = {'scope':'Staged files' if args.staged else 'Changed and untracked non-ignored files',
        'files':len(paths),'findings':findings,'passed':not findings,'secret_values_printed':False}
    (ROOT/'evals/reports/private-value-scan.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))
    raise SystemExit(1 if findings else 0)


if __name__ == '__main__':
    main()
