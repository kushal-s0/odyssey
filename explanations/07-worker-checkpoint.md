# Worker implementation checkpoint — T07 is unfinished

This guide records implemented primitives, not a usable worker deployment. The latest continuation point is `planning/SESSION_HANDOFF.md`.

`supabase/migrations/202610170004_worker_runtime.sql` adds a service-only runtime-presence table and compatible-stage claiming. A repeated claim from the same worker can recover a lost response without a new lease generation/attempt. New claimants receive a higher generation after expiry; stale workers cannot write through the service guards. Existing screening intents gain translate/structure/assess stages without changing an applied migration.

`app/worker/manifest.py` records expected pinned artifacts and a canonical manifest hash. It does not say those models have been deployed or quality-validated. `capabilities.py` signs separate HS256 stage-specific capabilities bound to worker, stage, job, revision, lease generation, pipeline, input and manifest. This capability contract is distinct from the asymmetric user-identity JWT contract. A model worker must never receive a database/service-role credential.

`app/services/jobs.py` implements the database service for compatible claims, heartbeat, bounded checkpoints, idempotent publication, finite retry timing, failure and reconciliation states. Final official screening completion refuses to claim success without an assessment record. The actual T12 assessment validation/persistence hook is still missing. The service is not connected to HTTP routes or application startup/activity yet.

Four real PostgreSQL service tests check lost claim responses, heartbeats/checkpoints, duplicate/conflicting publication, stale generations, backend-waiting/quota states and manifest mismatch. They use a synthetic one-stage job and prove orchestration primitives only. They do not prove HTTP authentication, a real process restart, Gradio enqueue or model inference.

Remaining T07 work: restricted claim/input/source/renewal/checkpoint/publication routes, scoped progress/cancel/resume routes, startup/activity reconciliation, executable outbound owned-worker sessions with heartbeat/backoff/input verification, bounded Gradio adapter/event recording and end-to-end process termination/recovery checks. Validate capabilities before expensive model work. Do not advertise a worker startup command until that command actually exists and passes its checks.
