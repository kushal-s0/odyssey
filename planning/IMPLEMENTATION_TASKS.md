# Ordered implementation tasks for Codex

**Executor: Codex.** This replaces the earlier assignment to three human builders. No application task has been executed yet.

Read [CODEX_EXECUTION_PLAN.md](CODEX_EXECUTION_PLAN.md), resume from [TASK_STATUS.md](TASK_STATUS.md), and use [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the detailed product, API and scoring specification.

Execute in ascending order by default. The listed dependencies allow independent work to continue around external blockers; record any out-of-order execution. Missing required live verification prevents an integration being marked done.

## Task index

| ID | Task | Dependencies | Required report |
|---|---|---|---|
| T01 | Inspect repository and inventory the dataset | None | `task-reports/T01.md` |
| T02 | Scaffold application and local toolchain | T01 | `task-reports/T02.md` |
| T03 | Define contracts, domain rules and rubric | T02 | `task-reports/T03.md` |
| T04 | Implement database, revisions and private storage | T03 | `task-reports/T04.md` |
| T05 | Implement authentication and authorization | T04 | `task-reports/T05.md` |
| T06 | Implement uploads and submission APIs | T05 | `task-reports/T06.md` |
| T07 | Implement durable workers and job progress | T06 | `task-reports/T07.md` |
| T08 | Build applicant submission and recording UI | T03, T05, T06, T07 | `task-reports/T08.md` |
| T09 | Implement translation and structured text extraction | T03, T07 | `task-reports/T09.md` |
| T10 | Implement digital PDF and handwritten scan processing | T09 | `task-reports/T10.md` |
| T11 | Implement regional audio transcription | T09 | `task-reports/T11.md` |
| T12 | Implement evidence-backed ratings and totals | T09 | `task-reports/T12.md` |
| T13 | Build assessor workspace, evidence viewer and review | T08, T10, T11, T12 | `task-reports/T13.md` |
| T14 | Implement authorized similar-idea retrieval | T04, T09, T12 | `task-reports/T14.md` |
| T15 | Implement sourced local-business context | T05, T09, T13 | `task-reports/T15.md` |
| T16 | Implement all four comparison views | T12, T13, T14 | `task-reports/T16.md` |
| T17 | Implement clarification and reassessment | T11, T12, T13 | `task-reports/T17.md` |
| T18 | Implement business arithmetic checks | T09, T12, T13 | `task-reports/T18.md` |
| T19 | Implement reports and version history | T13, T14, T15, T16, T17, T18 | `task-reports/T19.md` |
| T20 | Evaluate dataset and publish actual results | T10, T11, T12, T14, T17, T18 | `task-reports/T20.md` |
| T21 | Harden access, uploads and failure boundaries | T05, T06, T07, T13, T14, T15, T16, T17, T19 | `task-reports/T21.md` |
| T22 | Implement and measure scalability | T07, T14, T16, T21 | `task-reports/T22.md` |
| T23 | Package reproducible deployment and CI | T02, T04, T07, T19, T21, T22 | `task-reports/T23.md` |
| T24 | Deploy and verify hosted environment | T20, T22, T23 | `task-reports/T24.md` |
| T25 | Run deployed acceptance and recovery checks | T24 | `task-reports/T25.md` |
| T26 | Write final implementation and readiness handover | T25 | `task-reports/T26.md` |

## Completion rule for every task

Implement the task, run its acceptance checks, then create `planning/task-reports/TXX.md` using [TEMPLATE.md](task-reports/TEMPLATE.md). Include actual changed files, observable behavior, exact commands/results, test environment, configuration/migrations, limitations and next task. Update `TASK_STATUS.md` and `implementation-tasks.csv` after the report exists. Unmet required checks prevent `done`.

Paths below are intended implementation targets, not existing files. Equivalent clear names are acceptable if recorded. Choose verification commands from the actual toolchain and record what ran; do not invent test success.

## T01 - Inspect repository and inventory the dataset

**Dependencies:** None.

**Primary files:** `scripts/inventory_dataset.py`, `evals/manifests/`, `docs/DATASET_NOTES.md`.

**Implement:**

Read repository instructions and the original brief; preserve user files and uploaded archives. Build repeatable manifest entries with paths, hashes, sizes, language labels, PDF pages/text quality, audio codecs/durations and scenario families. Normalize Telegu/Telugu and trailing spaces; reject traversal/collisions. Inspect difficult representative samples and identify provider prerequisites.

**Acceptance checks:**

Account for 42 PDFs and 13 recordings, including four 11-page scans without text layers. Re-running preserves identifiers and originals. Record uninspected content and human annotation needs; filenames are not ground truth.

**Required final action:** write `planning/task-reports/T01.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T02 - Scaffold application and local toolchain

**Dependencies:** T01.

**Primary files:** `apps/web/`, `apps/api/`, `infra/compose.yaml`, `.env.example`, `.github/workflows/ci.yml`.

**Implement:**

Create React/TypeScript/Vite and FastAPI projects with compatible stable dependencies and lockfiles. Separate contracts, routes, repositories, pipeline, providers and workers. Add typed settings, liveness endpoint, lint/typecheck/build commands and initial CI. Document separate development persistence/auth/storage. Exclude archives, personal data and secrets from Git/build contexts.

**Acceptance checks:**

Frontend production build, API startup and liveness response pass. Clean setup is reproducible. Missing configuration is actionable; frontend assets contain no secret.

**Required final action:** write `planning/task-reports/T02.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T03 - Define contracts, domain rules and rubric

**Dependencies:** T02.

**Primary files:** `apps/api/app/contracts/`, `apps/web/src/api/generated/`, `docs/ARCHITECTURE.md`, `docs/RUBRIC.md`, `evals/fixtures/`.

**Implement:**

Implement Pydantic/OpenAPI contracts and generated frontend types. Define field statuses, nulls, alternatives, evidence IDs, revisions and error shapes. Write domain-specific 0-4 anchors, weights, completeness applicability and ranking rules from IMPLEMENTATION_PLAN.md. Define provider interfaces and sanitized complete/partial/conflicting/irrelevant/failure fixtures.

**Acceptance checks:**

Schema checks accept valid partial records and reject invalid ratings/evidence structures. Generated types match API contracts. Rubric arithmetic, unknown handling and domain/trade/cohort meanings are explicit.

**Required final action:** write `planning/task-reports/T03.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T04 - Implement database, revisions and private storage

**Dependencies:** T03.

**Primary files:** `apps/api/app/db/`, `apps/api/app/repositories/`, `supabase/migrations/`.

**Implement:**

Migrate all tables in the architecture plan with foreign keys, scoped uniqueness, indexes and pgvector metadata. Add transactional enqueue intent/outbox, durable job stages and atomic publication keys. Keep files in private object storage. Configure database/storage policies and worker access boundaries; document deletion, retention and backup responsibilities.

**Acceptance checks:**

Migrations apply to an empty development database and are repeatable. History persists after restart; invalid relations/duplicate publication keys are rejected. Test storage privacy separately from database policies.

**Required final action:** write `planning/task-reports/T04.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T05 - Implement authentication and authorization

**Dependencies:** T04.

**Primary files:** `apps/api/app/auth/`, `apps/web/src/auth/`, `tests/api/`.

**Implement:**

Verify token signature, issuer, audience and expiry; implement login/logout/session-expiry UI. Assign roles/cohorts through trusted setup. Build reusable resource checks for submissions, uploads, jobs, sources, reports, reviews, similarity and analytics. Provision limited test identities without committing credentials.

**Acceptance checks:**

Two applicants and two cohorts prove allowed and denied access. Reject tampered/expired tokens and self-assigned privileges. Service keys remain server-side and absent from logs/assets.

**Required final action:** write `planning/task-reports/T05.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T06 - Implement uploads and submission APIs

**Dependencies:** T05.

**Primary files:** `apps/api/app/routes/uploads.py`, `apps/api/app/routes/submissions.py`, `apps/api/app/services/storage.py`.

**Implement:**

Implement upload initiation/completion and text/file submission. Bind attachment ownership/revision. Validate real signatures/types, bytes, PDF pages and audio duration, including MP4/OGG/browser audio. Stream to private storage, hash inputs and define abandoned-upload cleanup. Atomically save revision/job intent and return job ID; scope idempotency.

**Acceptance checks:**

All required input formats preserve intact originals; 11-page scans are accepted. Reject spoofed/oversized files and another user attachment. Duplicate requests neither leak information nor create unintended duplicate work.

**Required final action:** write `planning/task-reports/T06.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T07 - Implement durable workers and job progress

**Dependencies:** T06.

**Primary files:** `apps/api/app/worker/`, `apps/api/app/services/jobs.py`, `apps/api/app/routes/jobs.py`, `infra/compose.yaml`.

**Implement:**

Connect Celery/broker to durable jobs. Add stage states, checkpoints, leases/heartbeats, bounded retries/backoff, cancellation and stale-job reconciliation with scheduler locking. Enforce revision/pipeline/stage idempotency and atomic final publication. Expose authorized polling. Validate orchestration initially with a clearly labeled deterministic test handler.

**Acceptance checks:**

Worker termination resumes checkpointed work. Duplicate delivery and queue publication failure recover with one published result. Polling is authorized and actionable. Test-handler output is never described as actual AI assessment.

**Required final action:** write `planning/task-reports/T07.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T08 - Build applicant submission and recording UI

**Dependencies:** T03, T05, T06, T07.

**Primary files:** `apps/web/src/pages/SubmitIdea.tsx`, `apps/web/src/pages/MySubmissions.tsx`, `apps/web/src/components/`.

**Implement:**

Build text/audio/PDF tabs, preferred language, known location/cohort fields and consent. Add recording/playback, upload progress, denied-microphone fallback and duplicate-submit prevention. Connect real submit/poll APIs; recover after refresh and display failed/partial/retry states. Support mobile, keyboard and regional scripts; label fixtures.

**Acceptance checks:**

A signed-in applicant submits each supported type and sees persisted state. Refresh, upload failure and denied microphone have recovery paths. Mobile/keyboard checks pass; absent processing stages are not shown as completed.

**Required final action:** write `planning/task-reports/T08.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T09 - Implement translation and structured text extraction

**Dependencies:** T03, T07.

**Primary files:** `apps/api/app/providers/llm.py`, `apps/api/app/pipeline/normalize.py`, `apps/api/app/pipeline/structure.py`.

**Implement:**

Implement configured hosted model adapter with explicit model ID, schemas, timeouts and usage tracking. Segment original text, detect language per segment and translate preserving numbers/units/places. Map fields semantically, preserving missing/irrelevant/ambiguous/unreadable statuses and conflict alternatives. Remove identity from scoring input. Validate references and allow one bounded JSON repair.

**Acceptance checks:**

Real representative text/mixed-language examples persist typed records with valid sources. Unknowns stay null and changed questions do not invent facts. Invalid JSON, timeouts and source instruction injection are handled. Missing live credentials block required live verification.

**Required final action:** write `planning/task-reports/T09.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T10 - Implement digital PDF and handwritten scan processing

**Dependencies:** T09.

**Primary files:** `apps/api/app/pipeline/pdf.py`, `apps/api/app/providers/vision.py`, `evals/fixtures/pdf/`.

**Implement:**

Extract text/layout and check corruption/question mapping. Render suspect/scanned pages for configured visual extraction with bounded pixels/pages/runtime/temp storage. Keep actual page references and reliable boxes. Preserve overwritten alternatives; text extraction order does not identify the intended answer. Feed T09 and checkpoint page progress with reviewable partial output.

**Acceptance checks:**

Process complete, broken-text, mixed-language and overwritten examples plus a full 11-page Hindi scan. Sources open actual pages and uncertain handwriting is flagged. Malformed/encrypted inputs fail safely; interrupted processing resumes.

**Required final action:** write `planning/task-reports/T10.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T11 - Implement regional audio transcription

**Dependencies:** T09.

**Primary files:** `apps/api/app/pipeline/audio.py`, `apps/api/app/providers/speech.py`, `evals/fixtures/audio/`.

**Implement:**

Inspect/normalize audio using safe ffprobe/FFmpeg arguments. Call the configured speech model, retaining original-language transcript and supported timestamps. Chunk within provider limits, preserve global offsets and remove overlap duplication. Pass segments through T09. Record uncertain language/quality and measured usage; do not fabricate timestamp precision.

**Acceptance checks:**

Representative Hindi, Telugu, Bengali and Odia recordings produce inspectable transcripts/records. Playback references align with actual sources. Silence, invalid/long media and provider errors stay within retry/runtime limits.

**Required final action:** write `planning/task-reports/T11.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T12 - Implement evidence-backed ratings and totals

**Dependencies:** T09.

**Primary files:** `apps/api/app/pipeline/assess.py`, `apps/api/app/domain/scoring.py`, `apps/api/app/routes/assessments.py`, `tests/api/test_scoring.py`.

**Implement:**

Assess validated facts in a separate structured call using versioned domain anchors. Calculate potential, coverage, completeness applicability and review gating deterministically. Preserve strengths/gaps/risks, claim-versus-external evidence and model/prompt/rubric/input versions. Validate references/ranges before publication; exclude partial/incompatible records from rankings.

**Acceptance checks:**

Exact arithmetic checks cover complete, partial, no-assessable-domain and conflicting cases. Reasons have valid evidence or insufficient-evidence labels. Real results survive restart; identity/social category/grammar are not scoring features.

**Required final action:** write `planning/task-reports/T12.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T13 - Build assessor workspace, evidence viewer and review

**Dependencies:** T08, T10, T11, T12.

**Primary files:** `apps/web/src/pages/Assessment.tsx`, `apps/web/src/pages/ReviewQueue.tsx`, `apps/api/app/routes/reviews.py`.

**Implement:**

Show original/English evidence, facts, seven domains, coverage, strengths/gaps and conflicts. Open actual pages/text/audio through authorized short-lived access. Build paginated/filterable review queue and failure states. Add reasoned outcomes and corrections with expected-revision checks; retain immutable history and invalidate derivatives on correction.

**Acceptance checks:**

All formats work from submit through source inspection/review. Correction creates a new version without losing prior evidence/actions. Stale edits and unauthorized evidence/review access are denied.

**Required final action:** write `planning/task-reports/T13.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T14 - Implement authorized similar-idea retrieval

**Dependencies:** T04, T09, T12.

**Primary files:** `apps/api/app/pipeline/similarity.py`, `apps/api/app/routes/similar.py`, `apps/web/src/components/SimilarIdeas.tsx`.

**Implement:**

Embed bounded English offer/customer/problem fields using the selected MiniLM revision. Store normalized vectors/provenance. Retrieve top five allowed candidates using pgvector; exclude own revisions and account for repeated dataset families. Explain shared traits/differences using real fields and connect UI. Permission-filter inside queries, not after disclosure.

**Acceptance checks:**

Annotated positive/hard-negative pairs yield measured Recall@5 and grounded reasons. Unauthorized candidates and own revisions never appear. Do not mix model versions/stale records or describe cosine similarity as probability/plagiarism.

**Required final action:** write `planning/task-reports/T14.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T15 - Implement sourced local-business context

**Dependencies:** T05, T09, T13.

**Primary files:** `apps/api/app/providers/places.py`, `apps/api/app/routes/location_insights.py`, `apps/web/src/components/LocalContext.tsx`.

**Implement:**

Query configured Places using confirmed location/category; resolve ambiguity before exact-area claims. Show attribution, query scope/time and precision in a list. Separate applicant claims from retrieved businesses. Follow provider display/retention requirements and avoid blanket caching. Handle missing location/key, empty results, timeout and quota limits independently of core assessment.

**Acceptance checks:**

One real configured lookup returns attributed context. Empty results never prove no competition; approximate locations stay labeled. Outages/ambiguity do not destroy core results or generate invented enrichment.

**Required final action:** write `planning/task-reports/T15.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T16 - Implement all four comparison views

**Dependencies:** T12, T13, T14.

**Primary files:** `apps/api/app/routes/analytics.py`, `apps/api/app/repositories/analytics.py`, `apps/web/src/pages/Dashboard.tsx`.

**Implement:**

Add scoped SQL aggregates, controlled sector/trade labels and bounded filters/pagination. Build domain, trade, cohort and across-cohort/within-trade views. Enforce same-rubric complete-domain ranking eligibility; show counts/denominators/exclusions. Clearly label synthetic demo cohorts and exclude repeated scenario families from default population statistics.

**Acceptance checks:**

All four views match known aggregate fixtures. Empty/small groups, mixed rubrics and incomplete records do not generate misleading ranks. Filters/aggregates preserve cohort access boundaries and demo labels.

**Required final action:** write `planning/task-reports/T16.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T17 - Implement clarification and reassessment

**Dependencies:** T11, T12, T13.

**Primary files:** `apps/api/app/pipeline/clarify.py`, `apps/api/app/routes/clarifications.py`, `apps/web/src/components/ClarificationFlow.tsx`.

**Implement:**

Select at most three grounded gap/conflict questions, prioritizing critical numbers/location and offer/customer facts. Translate to preferred language; accept text/audio via existing paths. Persist question IDs, answers/evidence and revision linkage. Queue idempotent reassessment with stale-write protection. Show before/after facts, ratings and coverage; retain historical reviewer decisions.

**Acceptance checks:**

A real incomplete example receives useful questions and a response creates an evidence-linked revision. Repeated/stale answers do not duplicate/overwrite history. Coverage changes differ visibly from potential changes; never promise a higher score.

**Required final action:** write `planning/task-reports/T17.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T18 - Implement business arithmetic checks

**Dependencies:** T09, T12, T13.

**Primary files:** `apps/api/app/domain/economics.py`, `apps/web/src/components/ArithmeticChecks.tsx`, `tests/api/test_economics.py`.

**Implement:**

Normalize currencies/units/periods with decimal arithmetic. Check supplied price x daily sales x operating days against revenue and own funds + loan against investment. Check profit only when compatible revenue/cost inputs exist; otherwise clarify. Show evidence/assumptions and discrepancies without overwriting stated values.

**Acceptance checks:**

Tea example computes 120 x 10 x 25 = 30000 monthly revenue, never profit. Cover mixed periods, missing costs, decimal precision and ambiguous currency. Actual UI displays grounded checks with uncertainty preserved.

**Required final action:** write `planning/task-reports/T18.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T19 - Implement reports and version history

**Dependencies:** T13, T14, T15, T16, T17, T18.

**Primary files:** `apps/api/app/routes/reports.py`, `apps/web/src/pages/AssessmentReport.tsx`, `apps/web/src/components/VersionHistory.tsx`.

**Implement:**

Build authorized version-specific HTML reports and browser print-to-PDF. Include English summary, domains/coverage/completeness, evidence, gaps/risks, similar ideas, local context, review state and generation time. Add version navigation/provenance. Follow provider export rules and avoid exposing signed private-file tokens/credentials.

**Acceptance checks:**

Multipage reports are readable with required sections and honest unavailable states. Historical reports represent their own facts. Unauthorized access is denied; exports contain no secrets or reusable private-file access.

**Required final action:** write `planning/task-reports/T19.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T20 - Evaluate dataset and publish actual results

**Dependencies:** T10, T11, T12, T14, T17, T18.

**Primary files:** `evals/annotations/`, `evals/run.py`, `evals/reports/`, `docs/EVALUATION.md`.

**Implement:**

Prepare reviewed labels and family-separated tuning/holdout manifests. Measure field/critical-number accuracy, status precision/recall, evidence validity, retrieval and rating stability. Use manually transcribed audio and verified equivalent-language pairs for speech and fairness checks. Account for all 55 inputs; record actual usage/latency and annotation limitations.

**Acceptance checks:**

Report numerators/denominators by language/format/difficulty. No family leakage or filename-based ground truth. Measure targets in IMPLEMENTATION_PLAN.md and fix failures; missing required human validation/unmet release gates remain explicit blockers.

**Required final action:** write `planning/task-reports/T20.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T21 - Harden access, uploads and failure boundaries

**Dependencies:** T05, T06, T07, T13, T14, T15, T16, T17, T19.

**Primary files:** `tests/api/`, `apps/api/app/middleware/`, `docs/SECURITY_CHECKS.md`.

**Implement:**

Test all routes/storage with two users/two cohorts. Bound parsing/subprocess resources, sanitize rendered output and prevent unsafe arbitrary URL fetches. Inject source instructions, silent media, encrypted PDFs, invalid JSON and provider auth/quota/timeouts. Verify log redaction/trusted roles; implement authorized source/derived deletion with minimal audit retention.

**Acceptance checks:**

Resource access matrix passes including similarity/aggregates. Failures are bounded/actionable with no invented success or source-instruction execution. Secrets/private-data checks pass and relevant dependency findings are resolved or explicitly triaged.

**Required final action:** write `planning/task-reports/T21.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T22 - Implement and measure scalability

**Dependencies:** T07, T14, T16, T21.

**Primary files:** `tests/load/`, `infra/compose.scale.yaml`, `apps/api/app/services/limits.py`, `docs/SCALABILITY.md`.

**Implement:**

Run two stateless API replicas and two workers with bounded database pools, shared rate/concurrency controls, queue admission and atomic provider budgets. Seed 10000 synthetic metadata records; inspect plans/indexes and remove unbounded/N+1 queries. Add request/job correlation, queue age/depth, heartbeats, latency/errors/usage metrics. Run the workload in CODEX_EXECUTION_PLAN.md and tune measured bottlenecks.

**Acceptance checks:**

Faults preserve accepted jobs and one published result per revision/pipeline. Record real hardware, workload, p50/p95 and errors; meet stated initial gates or keep required shortfalls open. Limits/budgets apply across replicas; mock throughput is separate from live AI capacity.

**Required final action:** write `planning/task-reports/T22.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T23 - Package reproducible deployment and CI

**Dependencies:** T02, T04, T07, T19, T21, T22.

**Primary files:** `infra/Dockerfile.api`, `infra/compose.yaml`, `infra/render.yaml`, `.github/workflows/ci.yml`, `.env.example`, `docs/OPERATIONS.md`.

**Implement:**

Build pinned non-root API/worker images with FFmpeg/PDF tools/embedding assets and frontend static output. Define services, secret references, reconciliation, resource limits, readiness/liveness and graceful shutdown. CI checks builds/types/contracts/tests and clean migrations. Document isolation, migrations, backup/restore ownership, rollback, secrets, spend and recovery.

**Acceptance checks:**

Clean setup builds/starts; migrations apply to empty test database. Health/shutdown/persistence checks pass and assets/images contain no secrets. CI-equivalent checks/manifests validate. This establishes deployability, not a public deployment.

**Required final action:** write `planning/task-reports/T23.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T24 - Deploy and verify hosted environment

**Dependencies:** T20, T22, T23.

**Primary files:** `infra/render.yaml`, `docs/DEPLOYMENT_RECORD.md`, `planning/DEPLOYMENT_CHECKLIST.md`.

**Implement:**

Use authorized hosting; configure secrets/policies/origins and limited demo accounts. Apply migrations and deploy broker/API/worker/reconciliation/frontend. Verify health/heartbeat. Run real text/PDF/scan/audio and local-business requests; inspect persisted evidence/usage. Record actual URL/release/configuration. Missing hosting/provider access is a blocker, never a simulated deployment.

**Acceptance checks:**

Public HTTPS login-to-assessment works with real providers and restart/refresh recovery. Deployed storage privacy, redirects/CORS and errors are verified. Missing required live checks prevent completion.

**Required final action:** write `planning/task-reports/T24.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T25 - Run deployed acceptance and recovery checks

**Dependencies:** T24.

**Primary files:** `tests/e2e/`, `docs/RELEASE_VERIFICATION.md`, `evals/reports/release/`.

**Implement:**

Run actual browser journeys across inputs, evidence, review, clarification, arithmetic, similarity, local context, comparisons and printing. Check mobile/keyboard, refresh/failure states and synthetic labels. Exercise access denial, controlled provider failure, duplicate/restarted jobs and rollback/redeploy. Record live latency/cost, fix regressions and reconcile deployment checklist.

**Acceptance checks:**

Required journeys pass on recorded URL/release and blocking regressions are fixed. Recovery/rollback preserves inputs without duplicate published versions. Report actual measurements and any unverified language/provider behavior.

**Required final action:** write `planning/task-reports/T25.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T26 - Write final implementation and readiness handover

**Dependencies:** T25.

**Primary files:** `README.md`, `docs/FINAL_IMPLEMENTATION_SUMMARY.md`, `docs/PRODUCTION_READINESS.md`, `docs/DEMO_SCRIPT.md`, `planning/TASK_STATUS.md`.

**Implement:**

Document architecture, setup/deployment/config names, supported formats/languages, roles, operations and limits. Map all brief requirements/features to actual implementation and evidence. Summarize evaluation, scale measurements, usage/cost, release URL/ID and pilot-level work. Prepare five-minute demo with labeled backups; reconcile every report/tracker/CSV entry.

**Acceptance checks:**

Every done task has substantive report/passed evidence; blocked work stays visible. Setup and actual deployment/evidence are discoverable. Distinguish implemented/tested/deployed/future work; no readiness or scale claim exceeds evidence.

**Required final action:** write `planning/task-reports/T26.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

