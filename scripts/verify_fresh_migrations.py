"""Rehearse every migration in a new, temporary loopback-only test database."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    configured = urlsplit((ROOT / '.local/test-database-url').read_text().strip())
    if configured.hostname not in {'127.0.0.1', 'localhost'}:
        raise SystemExit('Migration rehearsal requires loopback test PostgreSQL')
    name = 'odyssey_migrations_' + uuid4().hex[:12]
    # Generated identifier is never taken from a user, path, or configured database name.
    assert name.startswith('odyssey_migrations_') and len(name) == 31
    admin_url = urlunsplit(configured._replace(path='/postgres'))
    test_url = urlunsplit(configured._replace(path='/' + name))
    versions = []
    with psycopg.connect(admin_url, autocommit=True, connect_timeout=5) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
        try:
            with psycopg.connect(test_url, connect_timeout=5) as connection:
                connection.execute((ROOT / 'tests/db/bootstrap.sql').read_text())
                connection.execute('CREATE TABLE public.schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
                for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
                    body = path.read_bytes()
                    connection.execute(body.decode('utf-8'))
                    connection.execute('INSERT INTO public.schema_migrations(version,sha256) VALUES(%s,%s)',
                                       (path.name, hashlib.sha256(body).hexdigest()))
                    versions.append(path.name)
                connection.execute('ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY')
                connection.execute('REVOKE ALL ON public.schema_migrations FROM PUBLIC,anon,authenticated')
                count = connection.execute("SELECT count(*) FROM pg_tables WHERE schemaname='public'").fetchone()[0]
            report = {'scope': 'Fresh temporary database on existing loopback pgvector test server; local Auth/Storage shims',
                'migrations': versions, 'public_tables': count, 'passed': len(versions) == 8,
                'hosted_database_touched': False, 'temporary_database_removed': True, 'deployed': False}
        finally:
            admin.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(name)))
    (ROOT / 'evals/reports/fresh-migrations.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
