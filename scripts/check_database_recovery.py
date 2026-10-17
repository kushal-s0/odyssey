"""Check restart and dump/restore on this workspace's owned loopback test database."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]


def docker(*arguments: str, input_bytes: bytes | None = None) -> bytes:
    return subprocess.check_output(["docker", *arguments], input=input_bytes, stderr=subprocess.PIPE)


def main() -> None:
    url = (ROOT / ".local/test-database-url").read_text().strip()
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost"}:
        raise SystemExit("Recovery probe is restricted to the local test database")
    command = ["compose", "--env-file", str(ROOT / ".local/postgres.env"), "-f", str(ROOT / "infra/compose.test.yaml")]
    container = docker(*command, "ps", "-q", "postgres").decode().strip()
    if not container:
        raise SystemExit("Start this workspace's local test database first")
    metadata = json.loads(docker("inspect", container))[0]
    labels = metadata["Config"]["Labels"]
    working_directory = labels.get("com.docker.compose.project.working_dir", "")
    expected = str(ROOT / "infra")
    if os.path.normcase(os.path.normpath(working_directory)) != os.path.normcase(os.path.normpath(expected)):
        raise SystemExit("Container ownership does not match this workspace; refusing restart")
    actor, submission, revision, job, stage = [uuid4() for _ in range(5)]
    payload = {"synthetic": True, "probe": "local-durability"}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with psycopg.connect(url) as c:
        c.execute("INSERT INTO auth.users(id) VALUES(%s)", (actor,))
        c.execute("INSERT INTO public.profiles(id) VALUES(%s)", (actor,))
        c.execute("INSERT INTO public.submissions(id,owner_id,synthetic) VALUES(%s,%s,true)", (submission,actor))
        c.execute("INSERT INTO public.submission_versions(id,submission_id,revision_number,input_kind,source_text,input_hash,preferred_language,created_by) VALUES(%s,%s,1,'text','Synthetic recovery probe',%s,'en',%s)", (revision,submission,"f"*64,actor))
        c.execute("INSERT INTO public.processing_jobs(id,submission_id,input_revision_id,pipeline_version,backend) VALUES(%s,%s,%s,'recovery-probe','owned_worker')", (job,submission,revision))
        c.execute("INSERT INTO public.job_stages(id,job_id,stage_key,stage_order,input_hash,status,lease_owner,lease_until,lease_generation,attempts) VALUES(%s,%s,'extract:probe',0,%s,'running','recovery-worker',now()+interval '180 seconds',1,1)", (stage,job,"f"*64))
        assert c.execute("SELECT public.publish_stage(%s,'recovery-worker',1,%s,%s,'1',%s)", (stage,digest,"a"*64,Jsonb(payload))).fetchone()[0]
        c.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (job,))
    print("Committed synthetic stage publication; creating private local dump.", flush=True)
    backup = docker("exec", container, "pg_dump", "-U", "postgres", "-d", "udyam", "--format=custom")
    backup_path = ROOT / ".local/backups/verified-local.dump"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_bytes(backup)
    docker("restart", container)
    for attempt in range(30):
        try:
            with psycopg.connect(url, connect_timeout=2) as c:
                persisted = c.execute("SELECT output_hash FROM public.stage_publications WHERE stage_id=%s", (stage,)).fetchone()
                assert persisted and persisted[0] == digest
            break
        except psycopg.OperationalError:
            if attempt == 29:
                raise
            time.sleep(0.5)
    print("Restart preserved committed stage publication; restoring into a new isolated database.", flush=True)
    restore_name = "udyam_restore_" + uuid4().hex[:10]
    with psycopg.connect(url, autocommit=True) as c:
        c.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(restore_name)))
    docker("exec", "-i", container, "pg_restore", "-U", "postgres", "-d", restore_name,
           "--no-owner", "--no-acl", input_bytes=backup)
    connection_options = conninfo_to_dict(url)
    connection_options["dbname"] = restore_name
    with psycopg.connect(**connection_options) as c:
        assert c.execute("SELECT output_hash FROM public.stage_publications WHERE stage_id=%s", (stage,)).fetchone()[0] == digest
        assert c.execute("SELECT public FROM storage.buckets WHERE id='originals'").fetchone()[0] is False
        migrations = c.execute("SELECT count(*) FROM public.schema_migrations").fetchone()[0]
        version = c.execute("SHOW server_version").fetchone()[0]
    report = {"scope": "Owned local PostgreSQL only, with explicit Auth/Storage metadata shims; not a Supabase live restore.",
        "restart_preserved_publication": True, "restored_publication_hash_matches": True,
        "restored_bucket_private": True, "migration_versions": migrations,
        "postgres_version": version, "backup_bytes": len(backup),
        "limitations": "Object bytes/Auth service not backed up by this check. Restore uses --no-acl; reapply reviewed role/grant policies before serving users."}
    output = ROOT / "evals/reports/feasibility/database-recovery.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    with psycopg.connect(url) as c:
        c.execute("DELETE FROM public.submissions WHERE id=%s", (submission,))
        c.execute("DELETE FROM auth.users WHERE id=%s", (actor,))
    with psycopg.connect(url, autocommit=True) as c:
        c.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(restore_name)))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
