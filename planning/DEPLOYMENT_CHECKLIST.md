# Deployment and handover checklist

This is a **planned release checklist**, not a claim that services are already running. Executor: Codex. Apply this checklist during T23-T25 of the ordered backlog and record actual evidence in the corresponding task reports.

Before marking the release complete, record the deployed URL/version and link every completed check to a test result, command or reproducible observation. Unchecked required items remain open. See [CODEX_EXECUTION_PLAN.md](CODEX_EXECUTION_PLAN.md) and [TASK_STATUS.md](TASK_STATUS.md).

## 1. Deployment topology

| Service | Deployable unit | Durable state |
|---|---|---|
| Web | Vite static build on Render | None; frontend configuration contains public identifiers only |
| API | FastAPI Docker web service | Postgres and private object storage |
| Worker | Same Python image, separate Celery worker command | Checkpoints/results in Postgres; source files in private storage |
| Broker | Render Key Value/Redis-compatible service | Queue delivery; recover missing/stale work from database |
| Data | Supabase Postgres + Auth + private Storage + pgvector | Inputs, identities, versions, evidence, audit history and embeddings |
| External providers | Speech, LLM/vision and local business APIs | Record configured model/provider IDs and allowed request metadata |

Use one always-running worker for the demo, with bounded concurrency. Do not depend on ephemeral API filesystem storage or process-local background tasks. Run local API/worker/broker through Docker Compose against a separate development Supabase project, or a documented local equivalent; never point tests at the demo's production data.

## 2. Configuration contract

Create `.env.example` with placeholders and descriptions. Validate required settings at startup, and distinguish optional enrichment failure from missing core-processing configuration.

| Configuration | Visibility/purpose |
|---|---|
| `APP_ENV`, `PUBLIC_WEB_URL`, `CORS_ORIGINS` | Explicit development/staging/production behavior and allowed browser origins |
| `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public frontend config; access relies on authorization policies |
| `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server secrets and service identity; least-privilege use |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` | Token verification settings |
| `PRIVATE_UPLOAD_BUCKET`, `REDIS_URL` | Private object store and internal queue |
| `LLM_API_KEY`, `LLM_MODEL`, `VISION_MODEL` | Explicit provider credentials/model IDs; may share an accessible model |
| `SARVAM_API_KEY`, `ASR_MODEL` | Speech provider and pinned supported model |
| `GOOGLE_PLACES_API_KEY` | Server-side local business lookup; constrained to required API |
| `EMBEDDING_MODEL`, `EMBEDDING_REVISION` | Consistent vector generation; model packaged/downloaded during image build |
| `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `MAX_AUDIO_SECONDS` | Application limits, including support for the provided scans |
| `JOB_TIMEOUT_SECONDS`, `PROVIDER_TIMEOUT_SECONDS`, `MAX_JOB_ATTEMPTS` | Bounded runtime and retry settings |
| `DAILY_AI_BUDGET`, `MAX_AI_CALLS_PER_JOB`, `MAX_ACTIVE_JOBS_PER_USER` | Spend and overload controls; currency/unit documented |
| `DEMO_MODE`, `ENABLE_CLARIFICATIONS` | Explicit feature flags; no silent fake results |

Do not place private keys in `VITE_*`, commit them or log request headers. Codex access, inference-provider access and hosting are separate setup dependencies.

## 3. Release sequence

1. [ ] Confirm provider accounts, key access, actual model IDs, quotas and the hosting plan needed for a worker. Test one request per provider before building its UI.
2. [ ] Create development and deployment configuration; set secrets through the hosting dashboard/secret manager. Record the approved spend ceiling; do not assume free quotas cover the demo.
3. [ ] Apply versioned migrations to a clean database; enable pgvector; create private bucket and role/storage policies. Create demo accounts through trusted setup.
4. [ ] Build a reproducible Linux image with pinned Python dependencies, FFmpeg, PDF renderer and embedding model. Use a non-root process, bounded temporary storage and a narrow Docker build context.
5. [ ] Deploy broker, API and worker; start the periodic stale-job reconciliation process once, with database locking to prevent duplicate scheduling.
6. [ ] Verify readiness checks for database/queue and worker heartbeat. Expose provider availability as degraded capability status rather than probing paid APIs on every health request.
7. [ ] Deploy the frontend with correct API/auth origins. Verify HTTPS, CORS, microphone permission behavior and auth redirects from a clean browser session.
8. [ ] Seed masked demo examples and explicitly synthetic cohort memberships. Keep fixture/demo mode visibly separate from live inference.
9. [ ] Execute the live smoke flow for text, digital PDF, handwritten scan and short audio. Refresh midway and verify the same job resumes in the interface.
10. [ ] Run access, failure, restart and idempotency checks below. Capture request IDs, deployed commit, model versions, latency and evaluation report.
11. [ ] Tag a release, keep the previous image available and rehearse application rollback. Use backward-compatible migrations; do not rely on destructive down-migrations for rollback.
12. [ ] Publish the README, deployed URL and demo instructions in the hackathon handover. Record known limitations explicitly.

## 4. Checks that must pass

### User-visible behavior

- [ ] Text/audio/PDF submission works from the deployed UI; microphone failure offers upload.
- [ ] The 11-page Hindi scans are accepted. Broken or encrypted documents produce a helpful error rather than endless processing.
- [ ] Original text/audio/pages remain accessible to the authorized reviewer alongside English output.
- [ ] All seven assessment-domain displays exist; unknown values do not become fabricated facts or zero-quality ratings.
- [ ] Similar ideas, sourced local context and domain/trade/cohort/across-cohort views are functional, including empty states.
- [ ] A correction creates a new version and makes old/new evidence and reviewer actions understandable.
- [ ] Report printing/export includes version, coverage, original-source references and review status. Report access is authorized.
- [ ] Planned clarification and arithmetic features (T17-T18) are fully working and verified; unfinished work stays open in the task tracker.

### Access and data handling

- [ ] User A cannot fetch User B's submission, job, source, signed URL or report by changing an ID.
- [ ] Reviewers cannot retrieve another cohort's protected records through similarity, filters or aggregates.
- [ ] Applicants cannot change roles, attach someone else's file or choose an unauthorized cohort.
- [ ] Private storage rules pass tests separately from database policies. Privileged worker queries retain explicit ownership/cohort context.
- [ ] Logs omit raw submissions, tokens and contact details; error tracking uses request IDs.
- [ ] Untrusted PDF/audio contents cannot change system prompts, execute tools or override the rubric.
- [ ] Source retention is defined for the demo; deletion removes related objects, derived outputs and embeddings through an authorized workflow. Preserve audit entries without retaining deleted personal content.

### Recovery and cost

- [ ] Kill/restart a worker during extraction and prove stage recovery with one published assessment.
- [ ] Deliver the same job twice; unique constraints/checkpoints prevent duplicate stored results.
- [ ] Simulate queue publication failure and confirm database reconciliation recovers the pending job.
- [ ] Simulate invalid model JSON, timeout, HTTP 429 and missing credentials; errors are bounded, actionable and do not fabricate output.
- [ ] Simulate unavailable location lookup; core assessment remains accessible with the missing enrichment labeled.
- [ ] Apply upload/job limits, capped retries, API call caps and an overall usage budget. Explain budget exhaustion in the UI.
- [ ] Record actual per-file usage and latency for short text/PDF/audio and long scans; distinguish queue wait, provider time and total time.
- [ ] Verify rollback to the previous application image. For a later real-user pilot, test database and object-storage backup restoration as well.

### Scalability and execution traceability

- [ ] T22 records multi-instance API/worker tests, 10,000-record query behavior and actual load/recovery measurements, including hardware and provider-mocking boundaries.
- [ ] Shared rate limits, queue admission, database pools and provider budget reservations hold across replicas.
- [ ] T23 has reproducible build/migration evidence; T24 has actual HTTPS deployment evidence; T25 has deployed regression/recovery evidence.
- [ ] Each completed task has its own `planning/task-reports/TXX.md`; tracker and CSV agree with reports.
- [ ] T26 produces `docs/FINAL_IMPLEMENTATION_SUMMARY.md` and `docs/PRODUCTION_READINESS.md` with requirement-to-evidence mapping.

## 5. Cost worksheet

Fill this with actual account rates and measured usage during T20/T25. These documents do not quote unverified prices.

```text
Per-submission cost = speech minutes × speech rate
                    + text input/output tokens × respective model rates
                    + visual page/image token cost
                    + local search requests × request rate
                    + storage/egress allocation

Demo budget = fixed hosting for the event
            + measured processing cost of the chosen demo/evaluation cases
            + explicit retry/rehearsal reserve
```

Track per-job estimated usage before expensive calls and reconcile with returned usage afterward. With concurrent jobs, reserve budget atomically so several workers cannot each spend the full remaining allowance. Cache your own validated intermediate outputs by revision/model/prompt; provider data caching remains subject to that provider's rules.

## 6. Handover package

- [ ] Public HTTPS application URL and login instructions using limited-access demo accounts.
- [ ] Repository with source, lockfiles, migration files, Docker/Render configuration and CI workflow.
- [ ] README with local run, secrets setup, architecture, deployment, supported formats/languages and known limitations.
- [ ] Dataset inventory plus sanitized evaluation fixtures; original beneficiary material excluded from public artifacts.
- [ ] Evaluation report with sample counts, held-out family separation, actual metrics, failure cases and model/rubric versions.
- [ ] Five-minute demo script, backup recording and clearly labeled preprocessed examples.
- [ ] Deployment smoke-test record and rollback instructions.

Completing this checklist establishes a deployable hackathon release. A real program rollout additionally needs organizer-approved scoring, a larger independent multilingual benchmark, sustained load testing and operational ownership.
