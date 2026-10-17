"""Verify real Supabase Auth/storage and owned inference with one disposable account.

Run against the already-started local app. No email is sent and existing users
are untouched. Test credentials and screenshots remain under ignored .local/.
"""
from __future__ import annotations

import json
import argparse
import os
from pathlib import Path
import secrets
import subprocess
import sys
from uuid import uuid4

import httpx
import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'apps/api'), str(ROOT / 'tests/api')]


def main() -> None:
    from app.config import Settings
    from app.services.storage import PrivateStorage
    from test_pdf_pipeline import text_pdf

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf-only', action='store_true')
    args = parser.parse_args()
    values = dotenv_values(ROOT / '.env.local')
    directory = ROOT / '.local' / ('live-app-' + uuid4().hex)
    directory.mkdir(parents=True)
    fixture = {'email': f'live-check-{uuid4().hex}@example.invalid',
               'password': secrets.token_urlsafe(32), 'directory': str(directory), 'pdfOnly': args.pdf_only}
    path = directory / 'fixture.private.json'
    path.write_text(json.dumps(fixture), encoding='utf-8')
    text_pdf(directory / 'synthetic.pdf')
    headers = {'apikey': values['SUPABASE_SERVICE_ROLE_KEY'],
               'Authorization': 'Bearer ' + values['SUPABASE_SERVICE_ROLE_KEY']}
    origin = values['SUPABASE_URL'].rstrip('/')
    user = None
    cohort = uuid4()
    try:
        with httpx.Client(timeout=30, follow_redirects=False) as client:
            response = client.post(origin + '/auth/v1/admin/users', headers=headers,
                                   json={**{k: fixture[k] for k in ('email', 'password')}, 'email_confirm': True})
            response.raise_for_status()
            user = response.json()['id']
        with psycopg.connect(values['DATABASE_URL'], connect_timeout=8) as connection:
            connection.execute("INSERT INTO public.profiles(id,role) VALUES(%s,'applicant')", (user,))
            connection.execute("INSERT INTO public.cohorts(id,name,synthetic) VALUES(%s,'Live verification cohort',true)", (cohort,))
            connection.execute("INSERT INTO public.cohort_memberships(user_id,cohort_id,role) VALUES(%s,%s,'applicant')", (user, cohort))
        print('Disposable live account provisioned; starting real browser checks.', flush=True)
        result = subprocess.run(['node', 'scripts/browser-live.mjs'], cwd=ROOT / 'apps/web',
                                env={**os.environ, 'LIVE_UI_FIXTURE': str(path)}, timeout=1500)
        if result.returncode:
            raise RuntimeError('Live browser check failed; inspect private local artifacts')
        report = json.loads((directory / 'result.json').read_text(encoding='utf-8'))
        report.update({'scope': 'Local UI/API/owned GPU; real hosted Supabase Auth, PostgreSQL and private storage',
                       'deployed_application': False, 'synthetic_account': True})
        (ROOT / 'evals/reports/live-app.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print('PASS: real Supabase-backed browser and model journeys.', flush=True)
    except Exception as error:
        print('Live verification failed:', type(error).__name__, flush=True)
        raise SystemExit(1) from None
    finally:
        if user:
            try:
                with psycopg.connect(values['DATABASE_URL'], connect_timeout=8) as connection:
                    objects = [row[0] for row in connection.execute('SELECT object_path FROM public.attachments WHERE owner_id=%s', (user,))]
                    if objects:
                        PrivateStorage(Settings()).delete(objects)
                    connection.execute('DELETE FROM public.submissions WHERE owner_id=%s', (user,))
                    connection.execute('DELETE FROM public.attachments WHERE owner_id=%s', (user,))
                    connection.execute('DELETE FROM public.cohorts WHERE id=%s', (cohort,))
                with httpx.Client(timeout=30) as client:
                    response = client.delete(origin + '/auth/v1/admin/users/' + user, headers=headers)
                    response.raise_for_status()
                print('Disposable verification account/data removed; existing accounts retained.', flush=True)
            except Exception as error:
                print('Scoped verification cleanup needs retry:', type(error).__name__, flush=True)
        path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
