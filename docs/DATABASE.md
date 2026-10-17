# Database, private storage and durable stages

## Implemented boundary

T04 implements real PostgreSQL/pgvector migrations, database RLS and private-object metadata policies, a bounded connection pool, stage claim/heartbeat/publication functions, and a Supabase private-storage adapter. Local tests use PostgreSQL 17 with explicit test Auth/Storage metadata shims; they do not provision the actual Supabase Auth/Storage services. Hosted plans, live object operations and networking remain separate gates.

Migrations live in `supabase/migrations/`:

1. `202610170001_core.sql`: identities/cohort memberships, immutable-version data structure, uploads/evidence, structured business facts, jobs/stages/publications, assessments/domain values, vector retrieval, location/clarification/review history, audit/idempotency/shared-limit tables and indexes.
2. `202610170002_access.sql`: trusted-role/assigned-cohort read helpers, per-resource RLS, browser write denial, worker-table isolation and private originals bucket/object read policy. Private functions use fixed search paths and execute grants.
3. `202610170003_stages.sql`: atomic SKIP LOCKED claims, bounded leases/retries, monotonic fencing generations, guarded heartbeat and idempotent publication.

`scripts/migrate.py` uses a transaction/advisory lock and checksums; an already applied migration is skipped only when its hash matches. Add new migration versions instead of editing applied history. The explicit `--local` mode uses loopback-only test shims; never deploy `tests/db/bootstrap.sql` to a hosted project. Real Supabase already owns its Auth/Storage schemas.

## Local startup and checks

```powershell
.venv/Scripts/python.exe -B scripts/prepare_local_db.py
docker compose --env-file .local/postgres.env -f infra/compose.test.yaml up -d
.venv/Scripts/python.exe -B scripts/migrate.py --local
.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api/test_database.py
```

Secrets are generated under ignored `.local`; the database binds only `127.0.0.1:55432`. Container memory/CPU are bounded and a named volume persists through restart. The image is pinned to the digest actually pulled. Do not publish the private dump, connection URL or `.local/postgres.env`.

`Database.transaction(subject, read_scoped=True)` sets the verified subject and authenticated role only for one transaction; pool reuse must not leak a previous subject. Trusted backend writes still require explicit actor/resource checks before invoking privileged operations. Models receive restricted HTTPS capabilities, not this database connection string or the storage service key.

## Atomicity and recovery

Create the input revision/job/stages in one transaction before returning accepted. `claim_stage` permits one claimant per unexpired lease and orders dependent stages. Every re-claim increments generation. `heartbeat_stage` refuses expired/replaced claims. `publish_stage` checks owner/generation/expiry/cancellation and publishes one row per stage; an identical duplicate returns false, a conflicting duplicate fails. Crashed inference may be repeated, but results cannot be published twice. HTTP/capability/dispatch integration is T07, not established by SQL alone.

Keep connection pools and queue admission bounded across replicas. The initial dataset uses exact vector retrieval; no approximate index is introduced without evidence. Real workload/scale measurements are T22. Supabase Free currently lists 500 MB database and 1 GB object storage; derived pages/audio and repeated egress must be budgeted separately. No paid automatic backup/PITR or paid worker is assumed.

## Backup and restore

`scripts/check_database_recovery.py` verifies only the owned local container after checking its Compose ownership label and loopback URL. It commits a synthetic stage, creates an ignored local custom-format dump, restarts the container, verifies the publication, restores into a newly named test database and compares the publication hash/private-bucket metadata. It then removes only its temporary probe data/copy. It does not back up actual object bytes or the live Supabase Auth service. Its `--no-acl` restore needs reviewed grants/policies reapplied before serving users.

For hosted operation, manual exports must cover application tables **and** authorized private object files, with checksums and a restoration rehearsal into a separate approved target. Respect managed Auth/Storage schema boundaries and role mapping. Live hosted restore/object backup remains unverified until account/configuration is available. Final commands, operator steps and troubleshooting belong in T27's deployment guide; do not present the local probe as proof of hosted recovery.
