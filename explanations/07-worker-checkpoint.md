# Durable outbound workers — T07 local implementation

The local HTTP runner and recovery checks are implemented. Model handlers and live hosted verification remain unfinished. Read [operations and commands](../docs/WORKER_OPERATIONS.md), [T07 evidence](../planning/task-reports/T07.md) and `planning/SESSION_HANDOFF.md`.

`supabase/migrations/202610170004_worker_runtime.sql` adds a service-only runtime-presence table and compatible-stage claiming. A repeated claim from the same worker can recover a lost response without a new lease generation/attempt. New claimants receive a higher generation after expiry; stale workers cannot write through the service guards. Existing screening intents gain translate/structure/assess stages without changing an applied migration.

`app/worker/manifest.py` records expected pinned artifacts and a canonical manifest hash. It does not say those models have been deployed or quality-validated. `capabilities.py` signs separate HS256 stage-specific capabilities bound to worker, stage, job, revision, lease generation, pipeline, input and manifest. This capability contract is distinct from the asymmetric user-identity JWT contract. A model worker must never receive a database/service-role credential.

`app/services/jobs.py` implements compatible claims, heartbeat, bounded checkpoints, idempotent publication, finite retries, shared capacity, failure and reconciliation. It is now connected to restricted worker routes, scoped user progress/cancel/resume and startup/authorized activity. Final screening completion still refuses success without an assessment row; T12 must implement validated atomic persistence.

The fifth additive migration adds service-only execution/dispatch records. `/begin` permits one invocation per generation before model import. The parent fetches/hash-checks sources, owns network/capabilities and renews leases. The child receives no API capability, claim/signing/database/service key; every checkpoint waits for durable acknowledgement. Watchdogs stop expired work and a pipe watcher stops orphaned children.

Twenty-four focused checks now cover actual PostgreSQL, HTTP worker termination/API restart, checkpoint recovery, stale workers, lost/duplicate responses, access/source integrity, timeouts and shared capacity. Simulated Gradio responses prove adapter behavior only. Live owned-Space enqueue/auth/quota and ZeroGPU compatibility remain unverified. The synthetic probe cannot claim screening stages and never claims inference. Real model integration/quality and deployments remain later tasks.
