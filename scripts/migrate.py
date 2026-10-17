"""Apply checksum-tracked SQL migrations; local bootstrap is explicit test infrastructure."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local", action="store_true")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env.local", override=False)
    url = ((ROOT / ".local/test-database-url").read_text().strip() if args.local else os.environ.get("DATABASE_URL"))
    if not url:
        raise SystemExit("Configure DATABASE_URL privately, or prepare the --local database")
    if args.local and urlsplit(url).hostname not in {"localhost", "127.0.0.1"}:
        raise SystemExit("Local bootstrap is restricted to loopback databases")
    with psycopg.connect(url, connect_timeout=5) as connection:
        connection.execute("SELECT pg_advisory_xact_lock(%s)", (71392017,))
        if args.local:
            connection.execute((ROOT / "tests/db/bootstrap.sql").read_text())
        connection.execute("CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())")
        connection.execute("ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY")
        connection.execute("REVOKE ALL ON public.schema_migrations FROM PUBLIC,anon,authenticated")
        for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            source = path.read_bytes()
            digest = hashlib.sha256(source).hexdigest()
            row = connection.execute("SELECT sha256 FROM public.schema_migrations WHERE version=%s", (path.name,)).fetchone()
            if row:
                if row[0] != digest:
                    raise RuntimeError("Applied migration changed; add a new version: " + path.name)
                print(path.name + ": already applied")
                continue
            connection.execute(source.decode("utf-8"))
            connection.execute("INSERT INTO public.schema_migrations(version,sha256) VALUES(%s,%s)", (path.name,digest))
            print(path.name + ": applied")


if __name__ == "__main__":
    try:
        main()
    except psycopg.Error as error:
        print('Database migration failed (' + type(error).__name__ + '). Connection details remain private; check the configured project and network.')
        raise SystemExit(1) from None
