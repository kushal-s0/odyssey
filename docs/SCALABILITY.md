# Measured local capacity

Actual 18 October 2026 check; no public service load and no deployed/free-cloud capacity claim.

| Workload | Observed result |
|---|---|
|10000 synthetic metadata records;50 virtual sessions,3-second request pace,3-second ramp;303s elapsed|4988 requests; p50 86.335 ms, p95 212.115 ms;0 errors|
|Submissions / job status / analytics route p95|212.502ms /135.253ms /812.092ms|
|Two separate native FastAPI processes, three DB connections each, independent streaming Node round-robin proxy|Both replicas served normal signed-session/RLS traffic; cross-replica write/read succeeded, no sticky sessions|
|Two native synthetic stage workers,20 accepted jobs;terminate one after checkpoint and explicitly expire only its local lease|20 completed,20 unique publications,0 remaining;recovered generation2|
|One-second per-session overload diagnostic|625 requests in15.984s;p95 1,944.633 ms;0 errors; latency target FAILED|

The fifty sessions share one synthetic applicant identity with a large owned collection. Two-user/two-cohort isolation is tested separately; this is not fifty independently reviewed people. Actual routes, crypto signature checks, trusted DB roles, SQL/RLS, HTTP workers and leases are used. Metadata rows and tiny orchestration handlers are fixtures, not model assessments. The GPU worker remains concurrency1; measured Qwen peak~4.35GB per process makes two copies exceed this laptop's~8.15GiB budget including overhead.

Host:16 logical CPUs,Windows native API/driver/proxy. Existing optional PostgreSQL container capped1.5 CPUs/512MiB; snapshot~42.79% CPU/220.1MiB during paced load. Native API peak working sets observed~80MB each; these are not isolated Render memory/CPU limits. Model latency/VRAM is separate in feasibility/followup reports. No unlimited throughput, automatic GPU scaling or HF/free-service quota inference follows.

## Repairs and limits

Index migration007 fixes referencing-FK cleanup/join paths; migration008 preserves owner/admin/assigned-assessor RLS using set-based visibility. They were applied only locally unless a later approved remote verification is recorded. Trusted index-friendly scope predicates supplement RLS. Analytics reuses a scoped materialized record set. A 32-entry/five-second disposable memo rechecks actor/filter scope and current DB revision metadata before reuse; accepted jobs and results are always durable in PostgreSQL, and loss of the cache changes no workflow state.

Initial fixture auth/cleanup failures and a 9,230 ms/37.5%-error overload run are retained. Later faster-burst diagnostics still miss the latency goal. Charts can exceed500ms even in the paced run; the combined metadata p95 passes. New statistics are analyzed after synthetic bulk seeding, and exact synthetic IDs are recorded privately for scoped cleanup. No organizer input or hosted database participates.

Reproduce with .venv/Scripts/python.exe -B scripts/verify_scale.py --seconds 300 --rows 10000 --users 50 --pace-seconds 3. Requires the existing loopback test DB, Node and Python environments; do not run alongside DB/browser/model harnesses. Reports: evals/reports/scale.json,scale-one-second-diagnostic.json,scale-process-resources.json and scale-query-plan.json. This is native owned infrastructure; the optional container deployment profile is verified separately in packaging.
