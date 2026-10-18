"""Read-only safety check before restarting the configured owned app/worker.

Prints only a count; never prints source text, identities or connection secrets.
"""
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.config import get_settings  # noqa: E402


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise SystemExit('Configured database is unavailable; do not assume the worker is idle.')
    try:
        with psycopg.connect(settings.database_url.get_secret_value(),connect_timeout=10) as connection:
            connection.execute('SET TRANSACTION READ ONLY')
            row = connection.execute("SELECT count(*) FROM public.job_stages WHERE status='running'").fetchone()
            assert row is not None
            print(f'Active model stages: {row[0]}')
            raise SystemExit(0 if row[0]==0 else 2)
    except psycopg.Error as error:
        raise SystemExit('Read-only stage check failed: '+type(error).__name__+'; worker idleness is unverified.') from None


if __name__ == '__main__':
    main()
