# Data access, private originals and recoverable work

## Important code paths

- `db/pool.py:Database`: owns a bounded pool. Each transaction can set a verified subject; scoped reads use PostgreSQL's authenticated role and RLS. Subject/role settings are transaction-local and disappear before a connection is reused. Production connections require TLS.
- `scripts/migrate.py`: applies versioned SQL atomically with an advisory lock/checksum record. Local shims are an explicit option restricted to loopback, never a cloud Auth integration.
- `repositories/stages.py`: parameterized calls to database claim/heartbeat/publication operations. It hashes canonical serialized output before storing it. Models cannot submit arbitrary SQL through this interface.
- `services/storage.py:PrivateStorage`: bounded private object transfers, restricted short-lived read URLs and cleanup. Callers must first authorize resource ownership. It never turns the bucket public, follows arbitrary redirects or returns a service key to the browser. Actual Supabase object requests are not yet live-verified.
- The three SQL migrations establish all data/history entities, trusted-role/cohort read access, relational revision boundaries and durable stages. The separate SQL file under tests/db emulates identity claims and storage metadata solely for local tests.

## Why a database queue?

A free API or model Space can sleep/restart. In-process tasks would disappear. A committed input/job/stage remains in PostgreSQL and can be claimed again. The database is the source of truth; Gradio events are only delivery and a laptop is only an executor. Later T07 exposes scoped HTTPS operations and explicit waiting/retry states.

## Why a fencing generation?

A worker may freeze, lose its lease and return after a replacement starts. A lease timestamp by itself cannot prove the returning worker is still authorized to publish. Every claim gets an incrementing generation; heartbeat and publication must match the latest generation and live lease. A stale result is rejected even if it otherwise looks valid.

## How do you prevent duplicate assessments?

Unique input-revision/pipeline keys and stage publication keys prevent duplicate durable results. SQL locks the claimed stage before publishing. An identical retry is idempotent; a conflicting duplicate is an error. This does not promise exactly-once inference: a crash can repeat a model call. Checkpoints and bounded attempts limit wasted work.

## How are cohorts protected?

Users read their own submissions. Assessors read only assigned cohorts through trusted membership records; admins are assigned through trusted setup. Browser clients cannot update roles, grant cohort membership or claim worker stages. Related tables and object metadata check the same submission boundary; filtering a similarity/aggregate after disclosure would be insufficient.

## What has actually been tested?

Real local PostgreSQL checks cover migration repeatability, separate row/object policy visibility, role-escalation denial, concurrent claims, expired-worker rejection, idempotent/conflicting publication, cross-revision attachment protection and transaction-local subject reuse. A separate real container restart/dump/restore preserved a committed publication. These are local results with test shims; live Supabase Auth/Storage and hosted object recovery remain unverified.
