# Ordered implementation tasks for Codex

> **Latest user direction (17 October 2026):** prioritize a working hackathon solution, not production completion gates. Read [HACKATHON_RESET.md](HACKATHON_RESET.md) first. Its demo order supersedes the older mandatory sequential release/deployment gates below; preserve unfinished work honestly. Supabase is the single application database; local PG/Docker are optional tests. Secondary HF deployment and large scale experiments are deferred.

**Executor: Codex. Budget: no paid APIs or purchased hosting.** T01 is starting; no tasks are complete. T09A and T23A add custom-model training and model deployment without renumbering existing tasks.

Read [CODEX_EXECUTION_PLAN.md](CODEX_EXECUTION_PLAN.md), [FREE_MODEL_HOSTING_PLAN.md](FREE_MODEL_HOSTING_PLAN.md), [TASK_STATUS.md](TASK_STATUS.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

Use the explicit deadline order in [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md): T09/T09A/T12 precede T08; the index below is an ID lookup, not the execution order. Dependencies and its independent-work allowance govern work around recorded blockers. Every task requires implementation, actual acceptance checks, its own report using [TEMPLATE.md](task-reports/TEMPLATE.md), then tracker/CSV and SESSION_HANDOFF.md updates. No paid fallback, mock-as-live result or fabricated completion. T09A may conclude with a justified experimental-model rejection and a validated baseline; do not mislabel this as a successful trained-model deployment.

Deadline: **18 October 2026, 06:00 Asia/Calcutta**, deployed demo included. Prefer a measured owned-laptop worker for judging; retain free HF runtime deployment as its own target. Prepare an approved preview early without claiming final deployment tasks passed. Full implementation is authorized; publication still requires explicit approval. Maintain explanations/ alongside each task. T27 is the requested final deployment walkthrough.

## Task index

| ID | Task | Dependencies | Required report |
|---|---|---|---|
| T01 | Inspect dataset and prove free-runtime feasibility | None | `task-reports/T01.md` |
| T02 | Scaffold application and local toolchain | T01 | `task-reports/T02.md` |
| T03 | Define contracts, domain rules and rubric | T02 | `task-reports/T03.md` |
| T04 | Implement database, durable stage leases and private storage | T03 | `task-reports/T04.md` |
| T05 | Implement authentication and authorization | T04 | `task-reports/T05.md` |
| T06 | Implement uploads and submission APIs | T05 | `task-reports/T06.md` |
| T07 | Implement durable Postgres jobs and free-runtime dispatch | T06 | `task-reports/T07.md` |
| T08 | Build applicant submission and recording UI | T03, T05, T06, T07, T12 | `task-reports/T08.md` |
| T09 | Implement self-hosted extraction and Indic translation | T03, T07 | `task-reports/T09.md` |
| T09A | Train and evaluate our answer-relevance model | T09 | `task-reports/T09A.md` |
| T10 | Implement PDF and handwritten scans with open weights | T09 | `task-reports/T10.md` |
| T11 | Implement self-hosted regional audio transcription | T09 | `task-reports/T11.md` |
| T12 | Implement evidence-backed ratings and deterministic totals | T09, T09A | `task-reports/T12.md` |
| T13 | Build assessor workspace, evidence viewer and review | T08, T10, T11, T12 | `task-reports/T13.md` |
| T14 | Implement authorized similar-idea retrieval | T04, T09, T12 | `task-reports/T14.md` |
| T15 | Implement free OpenStreetMap business context | T05, T09, T13 | `task-reports/T15.md` |
| T16 | Implement all four comparison views | T12, T13, T14 | `task-reports/T16.md` |
| T17
| T18 | Implement business arithmetic checks | T09, T12, T13 | `task-reports/T18.md` |
| T19 | Implement reports and version history | T13, T14, T15, T16, T17, T18 | `task-reports/T19.md` |
| T20 | Evaluate dataset and our model with real measurements | T09A, T10, T11, T12, T14, T17, T18 | `task-reports/T20.md` |
| T21 | Harden access, uploads and failure boundaries | T05, T06, T07, T13, T14, T15, T16, T17, T19 | `task-reports/T21.md` |
| T22 | Measure portable API and model scalability | T07, T14, T16, T21 | `task-reports/T22.md` |
| T23 | Package zero-spend application deployment | T02, T04, T07, T19, T21, T22 | `task-reports/T23.md` |
| T23A | Package and deploy versioned model runtimes | T09A, T10, T11, T12, T23 | `task-reports/T23A.md` |
| T24 | Deploy and verify the full free hosted application | T20, T22, T23, T23A | `task-reports/T24.md` |
| T25 | Run deployed acceptance and recovery checks | T24 | `task-reports/T25.md` |
| T26 | Write final implementation and readiness handover | T25 | `task-reports/T26.md` |
| T27 | Write detailed free-deployment walkthrough | T26 | `task-reports/T27.md` |

## T01 - Inspect dataset and prove free-runtime feasibility

**Dependencies:** None.

**Primary files:** `scripts/inventory_dataset.py`, `evals/manifests/`, `docs/DATASET_NOTES.md`, `docs/FREE_FEASIBILITY.md`.

**Implement:**

Preserve sources and inventory the 55 files with hashes, media metadata and scenario families. Inspect representative hard inputs. Confirm the user-owned eligible Hugging Face account can create the two free Gradio ZeroGPU runtimes; do not create paid Docker Spaces. Spike authenticated API-to-Gradio stage enqueue, checkpointing and account-attributed GPU quotas. Test model access/license gates and one handwritten page, one regional audio chunk and one translated answer. Record memory/latency/compatibility; the user has confirmed eligibility, not successful provisioning.

Prove the preferred owned-laptop worker as well: RTX 5050 Laptop with 8151 MiB reported VRAM and approximately 24 GB system memory is observed hardware, not verified model fit. Pin a compatible CUDA/framework environment, check a real GPU operation, then run bounded text, handwriting, audio and translation inference. Measure cold/warm time, RAM/VRAM, source access and checkpoint recovery at concurrency one. Local execution has no provider inference allowance; hardware/network availability still matter. Keep backend results separate. Audio MP4 metadata must use a decoder/track-aware inspector; a prior simple parser returned false zero durations. Select explicit text/audio language identification and a labeled confirmation fallback. Do not claim declared language is automatically detected.

**Acceptance checks:**

Repeatable inventory accounts for 42 PDFs/109 pages, 13 recordings and the four 11-page scans, with hashes, extractor versions and decoded media metadata. Verify actual owned-worker model inference/resource fit and the separately selected free HF plans/access/quota/guarded stage path before claiming feasibility. Record unavailable permissions/quotas as specific blockers; no paid dependency or unverified CPU-Space assumption. Local scaffolding may proceed only under the delivery plan's explicit independent-work allowance.

**Required final action:** write `planning/task-reports/T01.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T02 - Scaffold application and local toolchain

**Dependencies:** T01.

**Primary files:** `apps/web/`, `apps/api/`, `infra/compose.yaml`, `.env.example`, `.github/workflows/ci.yml`.

**Implement:**

Create React/TypeScript/Vite and FastAPI projects with compatible stable dependencies and lockfiles. Separate contracts, routes, repositories, pipeline, providers and workers. Add typed settings, liveness endpoint, lint/typecheck/build commands and initial CI. Document separate development persistence/auth/storage. Exclude archives, personal data and secrets from Git/build contexts.

Prepare the minimal deployable frontend/API configuration and preview checklist here; final packaging stays in T23. Stage an exact sanitized preview artifact and destination for explicit publication approval | Implement clarification and reassessment | T11, T12, T13 | `task-reports/T17.md` |; no Git push, HF upload or automatic deploy. Do not call a skeleton preview the completed application. Original archives and .tools files are already tracked; ignore rules alone do not remove them. Preserve source files/history and exclude them from release build contexts. If T01's HF-only access checks are blocked, record the verified local/dataset prerequisite used for safe scaffolding and keep T01 blocked.

**Acceptance checks:**

Frontend production build, API startup and liveness response pass. Clean setup is reproducible. Missing configuration is actionable; frontend assets contain no secret.

**Required final action:** write `planning/task-reports/T02.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T03 - Define contracts, domain rules and rubric

**Dependencies:** T02.

**Primary files:** `apps/api/app/contracts/`, `apps/web/src/api/generated/`, `docs/ARCHITECTURE.md`, `docs/RUBRIC.md`, `evals/fixtures/`.

**Implement:**

Implement Pydantic/OpenAPI contracts and generated frontend types. Define field statuses, nulls, alternatives, evidence IDs, revisions and error shapes. Write domain-specific 0-4 anchors, weights, completeness applicability and ranking rules from IMPLEMENTATION_PLAN.md. Define provider interfaces and sanitized complete/partial/conflicting/irrelevant/failure fixtures.

Define language provenance (declared/detected/confirmed), model/backend readiness, `waiting_for_worker`, lease generation and capability expiry/renewal. Preserve additional evidence-linked facts from changed technical questionnaires rather than discarding them or matching by question number. Keep relevance, factual uncertainty and plausibility as separate judgments.

**Acceptance checks:**

Schema checks accept valid partial records and reject invalid ratings/evidence structures. Generated types match API contracts. Rubric arithmetic, unknown handling and domain/trade/cohort meanings are explicit.

**Required final action:** write `planning/task-reports/T03.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T04 - Implement database, durable stage leases and private storage

**Dependencies:** T03.

**Primary files:** `apps/api/app/db/`, `apps/api/app/repositories/`, `supabase/migrations/`.

**Implement:**

Implement the architecture tables on Supabase Free with indexes, scoped uniqueness and pgvector. Postgres is the durable queue: input/job/stage creation and dispatch intent are transactional; add leases, retry-at times and atomic publication keys. Protect claim/checkpoint operations and private object storage. No hosted Redis requirement. Budget database/object storage/egress within free limits; define deletion and manual export/restore procedures.

Add an incrementing lease generation checked atomically on claim renewal, checkpoint and publication. Reject writes from expired/replaced claims, including a worker that returns after a newer claimant starts. Verify actual API-to-Supabase networking and TLS/session-pooler configuration without buying an IPv4 add-on. Keep total connection pools bounded across replicas and avoid transaction-pooler features unsupported by the chosen driver.

**Acceptance checks:**

Migrations apply cleanly and repeatably. Concurrent claims are exclusive; expired/replaced workers cannot checkpoint or publish with stale fencing values. History survives restart and duplicate publication is rejected. Database/storage policies, verified connection mode, bounded pools, free quotas and manual backup assumptions are documented.

**Required final action:** write `planning/task-reports/T04.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T05 - Implement authentication and authorization

**Dependencies:** T04.

**Primary files:** `apps/api/app/auth/`, `apps/web/src/auth/`, `tests/api/`.

**Implement:**

Verify token signature, issuer, audience and expiry; implement login/logout/session-expiry UI. Assign roles/cohorts through trusted setup. Build reusable resource checks for submissions, uploads, jobs, sources, reports, reviews, similarity and analytics. Provision limited test identities without committing credentials.

Precreate limited password-based judging accounts through trusted setup. Verify the project's real JWT signing/key configuration instead of assuming a particular key algorithm. Do not rely on free default SMTP for public signup or last-minute magic links; document account recovery without paid SMS/email dependence.

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

## T07 - Implement durable Postgres jobs and free-runtime dispatch

**Dependencies:** T06.

**Primary files:** `apps/api/app/worker/`, `apps/api/app/services/jobs.py`, `apps/api/app/routes/jobs.py`, `apps/api/app/routes/internal_jobs.py`.

**Implement:**

Implement Postgres stage claiming and bounded Gradio event enqueue through a runtime adapter, plus a local worker adapter for tests/owned hardware. Persist event IDs, checkpoints, leases/heartbeats and finite retry-at times. Authenticate job-specific capabilities before inference and use restricted HTTPS checkpoint APIs, not full database keys in models. Reconcile on startup, authorized app activity and explicit resume; allow completion-triggered next-stage dispatch. Do not assume a daemon can run while free services sleep.

Make the owned-laptop adapter usable for real judging inference, not just fixtures. Use authenticated outbound claim/checkpoint operations and show `waiting_for_worker` when offline; no exposed laptop port is required. Persist backend selection and lease generation. Start bounded operator worker sessions for actual work, with backoff and explicit resume; no artificial anti-sleep pings. HF events still need separate live enqueue/quota proof. Validate capabilities outside GPU-decorated work; fetch fresh source URLs only after claim and define renewal when queue delays outlast capability expiry.

**Acceptance checks:**

A duplicate event, lost enqueue response, worker termination, late stale claimant and sleeping/offline runtime preserve accepted input and one published version. Progress exposes waiting_for_worker, waiting_for_runtime and quota_exhausted accurately. Real owned-worker claim/checkpoint recovery is verified separately from Gradio enqueue. Deterministic handlers prove orchestration only; no paid worker/broker is required.

**Required final action:** write `planning/task-reports/T07.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T08 - Build applicant submission and recording UI

**Dependencies:** T03, T05, T06, T07, T12.

**Primary files:** `apps/web/src/pages/SubmitIdea.tsx`, `apps/web/src/pages/MySubmissions.tsx`, `apps/web/src/components/`.

**Implement:**

Build text/audio/PDF tabs, preferred language, known location/cohort fields and consent. Add recording/playback, upload progress, denied-microphone fallback and duplicate-submit prevention. Connect real submit/poll APIs; recover after refresh and display failed/partial/retry states. Support mobile, keyboard and regional scripts; label fixtures.

Use the already verified T09/T12 text pipeline to show a real persisted text assessment here. Upload/record UI for other formats may report queued/waiting until T10/T11 pass; do not mark unimplemented modality processing complete. Reuse the early preview configuration after explicit publication approval.

**Acceptance checks:**

A signed-in applicant submits each supported type and sees persisted state; text reaches a real persisted assessment through T09/T12. PDF/audio processing not yet implemented is labeled waiting rather than completed. Refresh, upload failure and denied microphone have recovery paths. Mobile/keyboard checks pass and fixture results are labeled.

**Required final action:** write `planning/task-reports/T08.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T09 - Implement self-hosted extraction and Indic translation

**Dependencies:** T03, T07.

**Primary files:** `apps/api/app/providers/local_models.py`, `apps/api/app/pipeline/normalize.py`, `apps/api/app/pipeline/structure.py`, `models/manifest.json`.

**Implement:**

Run pinned Qwen3-VL-2B-Instruct text extraction and IndicTrans2 distilled translation through the selected owned-worker adapter, with the same contracts for HF runtime A/B. Use confirmed/validated language and answer-level segmentation, retaining original/English text and numbers/units. Enforce bounded output and Pydantic validation; small open models are not guaranteed schema adherence. Preserve missing/irrelevant/ambiguous/unreadable statuses and evidence alternatives. Record weights/license/runtime revisions and timings; no paid model key or fallback.

Prefer the verified owned worker for the judging path, using the same contracts as runtime A/B. Bound context/output/image sizes and serialize GPU work initially; do not assume all models fit simultaneously on 8 GB VRAM. Implement the T01 language-identification strategy with uncertainty and language provenance. Preserve additional technical fields, source numbers/units and names needed as business facts; exclude beneficiary identity from scoring. Validate English/Hindi with the available reviewer and label other language quality unvalidated.

**Acceptance checks:**

Actual owned-model inference handles representative text and mixed-language examples with valid evidence and null unknowns. JSON repair is bounded and prompt injection is ignored. Measure peak memory, cold/warm time and quota failure behavior; paid endpoints are absent from the executed path.

**Required final action:** write `planning/task-reports/T09.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T09A - Train and evaluate our answer-relevance model

**Dependencies:** T09.

**Primary files:** `training/build_pairs.py`, `training/train_relevance.py`, `training/evaluate_relevance.py`, `models/relevance/`, `docs/MODEL_CARD.md`.

**Implement:**

Follow FREE_MODEL_HOSTING_PLAN.md: create question-answer pairs with family/source IDs and label provenance; remove identity. Compare a rules/cosine baseline with frozen MiniLM features plus logistic regression. Keep all family variants/translations together in group splits. Report real class/group counts, confusion matrix, macro-F1, irrelevant precision/recall and abstention. Export reproducible candidate artifacts and a model card; record an explicit promote/reject decision. Do not train foundation models or a funding/business-success predictor.

Audit independent family/class counts before choosing a split; never force a metric from an empty or one-class holdout. Fit preprocessing/tuning on training/validation groups only. Only English/Hindi review is currently available. Keep the experiment bounded; reject promotion if independently reviewed groups are insufficient. Baseline serving allows T12 to proceed after the documented experiment even when the candidate is rejected. An implausible but on-topic answer is not automatically irrelevant.

**Acceptance checks:**

Re-running with pinned data/features/seed reproduces the experiment. No holdout leakage and no synthetic-only real-world accuracy claim. Promotion gates use independently reviewed real data; insufficient labels or failed gates keep the baseline active and candidate experimental. The task may finish with a justified rejection, but the release must not advertise an unvalidated model as validated.

**Required final action:** write `planning/task-reports/T09A.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T10 - Implement PDF and handwritten scans with open weights

**Dependencies:** T09.

**Primary files:** `apps/api/app/pipeline/pdf.py`, `apps/api/app/providers/vision.py`, `evals/fixtures/pdf/`.

**Implement:**

Use text/layout extraction first; render only suspect/scanned pages. Run bounded one-page Qwen3-VL calls in the selected owned worker or separately verified document Space, preserving original scans, source pages and reliable boxes. Printed OCR fallback does not prove handwriting support. Checkpoint page work and preserve uncertain overwrites as alternatives. Enforce pixel/page/runtime/memory budgets; no paid vision endpoint. Check suspicious glyph/script mixtures and layout corruption even when text has no null/replacement characters; use actual regional samples. Preserve technical facts and financial tables across the full 11-page scan without treating blank tables as zero values.

**Acceptance checks:**

Evaluate complete, corrupted-text, mixed-language and overwritten cases plus a full 11-page Hindi scan. Original pages open correctly and uncertain handwriting is flagged. Restart/quota exhaustion resumes from saved pages. Record actual extraction quality and GPU scheduling versus execution time.

**Required final action:** write `planning/task-reports/T10.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T11 - Implement self-hosted regional audio transcription

**Dependencies:** T09.

**Primary files:** `apps/api/app/pipeline/audio.py`, `apps/api/app/providers/speech.py`, `deploy/spaces/speech_translation/`.

**Implement:**

Use FFmpeg and pinned IndicConformer 600M through the selected owned worker; the HF speech Space initially uses ONNX Runtime CPU. Verify model access and inspected remote code; do not assume ONNX GPU execution is ZeroGPU-compatible. A supported local GPU/PyTorch path needs its own measurement. Chunk audio with global offsets and preserve original transcripts; translate via IndicTrans2. Implement the explicit audio language-identification strategy, requiring confirmation when unreliable, and label declared versus detected language. Use segment references if precise word timestamps are unavailable. Existing MP4 inputs are audio-only AAC containers; do not reject them because their extension suggests video.

**Acceptance checks:**

Run representative Hindi/Telugu/Bengali/Odia recordings on the actual selected owned runtime. Verify transcript/evidence alignment, memory and chunk latency; distinguish Hindi human validation from unvalidated other-language quality. Silence/invalid media and worker/quota/runtime interruption have bounded recovery. No paid ASR API is invoked; backend-specific measurements are not interchangeable.

**Required final action:** write `planning/task-reports/T11.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T12 - Implement evidence-backed ratings and deterministic totals

**Dependencies:** T09, T09A.

**Primary files:** `apps/api/app/pipeline/assess.py`, `apps/api/app/domain/scoring.py`, `apps/api/app/routes/assessments.py`, `tests/api/test_scoring.py`.

**Implement:**

Use validated facts and our self-hosted text model for evidence-grounded domain judgments, then calculate weights/coverage/completeness deterministically. Use the custom relevance classifier only when promoted; otherwise run its documented baseline. Neither classifier confidence nor missing answers predict business success. Preserve rubric/model/input versions, strengths/gaps/risks and evidence; compare only eligible records.

**Acceptance checks:**

Exact arithmetic checks cover complete/partial/no-evidence/conflicting cases. Actual self-hosted outputs cite valid evidence or state insufficiency. Identity/grammar are excluded from scoring. Promoted versus baseline classifier selection is explicit and reproducible; no paid inference dependency.

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

## T15 - Implement free OpenStreetMap business context

**Dependencies:** T05, T09, T13.

**Primary files:** `apps/api/app/providers/osm.py`, `apps/api/app/routes/location_insights.py`, `apps/web/src/components/LocalContext.tsx`.

**Implement:**

Use applicant-confirmed location/category with bounded Overpass queries; Nominatim is only explicit user-triggered geocoding with identifiable User-Agent, cache and a shared maximum one request/second. No bulk dataset geocoding/autocomplete. Cache results with attribution/date and include a small licensed regional snapshot fallback. Never send beneficiary identity. Distinguish retrieved listings, applicant claims, dated snapshots and fixtures; no Google Places API.

Public Nominatim is disabled until Kartik deliberately opts in after reviewing its policy; user-triggered lookup alone is not developer consent. Start with confirmed coarse coordinates/area and the licensed dated snapshot. Do not build a generic geocoding service or infer complete competitor coverage from OSM.

**Acceptance checks:**

A real policy-compliant lookup shows source/area/time and approximate location. Empty results do not prove no competition. Timeout/rate-limit/poor-coverage states preserve the assessment; rate limiting is shared across API replicas. Offline snapshot labels and attribution are correct.

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

## T20 - Evaluate dataset and our model with real measurements

**Dependencies:** T09A, T10, T11, T12, T14, T17, T18.

**Primary files:** `evals/annotations/`, `evals/run.py`, `evals/reports/`, `docs/EVALUATION.md`.

**Implement:**

Use reviewed family-separated labels for extraction/statuses/numbers/evidence/retrieval/rating checks and the relevance classifier. Account for all 55 inputs. Manually validated audio and equivalent-language pairs support speech/fairness claims. Record model manifests, real cold/warm inference time, CPU/RAM/GPU use, queue wait, free quota usage and uncertainty. Compare the classifier to its baseline; do not force promotion.

Run the corpus and repeated inference primarily on the owned laptop, reusing versioned outputs; do not spend the HF demo quota on a blanket evaluation run. Current reviewers cover English/Hindi only. Report unsupported quality claims as unvalidated with actual sample counts; folder labels or machine translations are not ground truth for the other languages. Record local and HF latency/usage separately.

**Acceptance checks:**

Reports include real numerators/denominators per language/format and no family leakage. Distinguish owned open-weight inference from the project-trained classifier. Assess release gates honestly; missing reviewed data and unmet required quality gates remain visible. Never substitute hosted paid models to meet a target.

**Required final action:** write `planning/task-reports/T20.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T21 - Harden access, uploads and failure boundaries

**Dependencies:** T05, T06, T07, T13, T14, T15, T16, T17, T19.

**Primary files:** `tests/api/`, `apps/api/app/middleware/`, `docs/SECURITY_CHECKS.md`.

**Implement:**

Test all routes/storage with two users/two cohorts. Bound parsing/subprocess resources, sanitize rendered output and prevent unsafe arbitrary URL fetches. Inject source instructions, silent media, encrypted PDFs, invalid JSON and model access/quota/timeouts. Verify log redaction/trusted roles; implement authorized source/derived deletion with minimal audit retention.

**Acceptance checks:**

Resource access matrix passes including similarity/aggregates. Failures are bounded/actionable with no invented success or source-instruction execution. Secrets/private-data checks pass and relevant dependency findings are resolved or explicitly triaged.

**Required final action:** write `planning/task-reports/T21.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T22 - Measure portable API and model scalability

**Dependencies:** T07, T14, T16, T21.

**Primary files:** `tests/load/`, `infra/compose.scale.yaml`, `apps/api/app/services/limits.py`, `docs/SCALABILITY.md`.

**Implement:**

Use only local/owned infrastructure for two APIs, two stage workers and a local Postgres test database. Seed 10000 synthetic metadata records; inspect query plans/indexes. Test 50 virtual metadata users and 20 queued recovery jobs as specified. Add shared admission/rate limits, bounded connection pools and model concurrency, memory/time budgets and free-quota states. Separately benchmark actual model stages at concurrency 1 and, if memory allows, 2.

**Acceptance checks:**

Record real hardware and p50/p95/errors/cold starts/peak RAM/VRAM. Accepted jobs survive duplicate/crash recovery with one published result. No load test hits free Supabase/ZeroGPU/Nominatim/Overpass. Report infrastructure capacity separately from inference throughput; the free demo does not claim automatic horizontal GPU scaling.

**Required final action:** write `planning/task-reports/T22.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T23 - Package zero-spend application deployment

**Dependencies:** T02, T04, T07, T19, T21, T22.

**Primary files:** `infra/Dockerfile.api`, `infra/compose.yaml`, `infra/render-free.yaml`, `deploy/pages/`, `.github/workflows/ci.yml`, `.env.example`, `docs/OPERATIONS.md`.

**Implement:**

Build a lightweight non-root API image without model frameworks/weights and a static Pages frontend. Define Render Free API and Supabase Free persistence settings; model events replace paid workers/Redis. Keep a local container profile for durable stage workers and local load tests. CI validates contracts/builds/tests/migrations. Document free plan limits, pause/resume, backup exports, rollback and no-paid-fallback policy.

Reuse T02's early deployment skeleton and finalize both selected laptop-worker and secondary Space adapter configuration. Include native laptop worker startup/stop/resume instructions, so unavailable Docker does not prevent the basic worker smoke check; container scaling checks still require real container infrastructure. Prepare sanitized artifacts with no dataset/.tools/secret inclusion. No automatic Git push or remote build deployment is authorized.

**Acceptance checks:**

Clean local deployment works and API fits the selected free runtime budget. Manifests contain no paid worker, broker, domain, GPU or add-on. Configuration/quotas are verified; a zero-spend flag alone is not proof. Secrets stay out of images/assets and runtime files remain disposable.

**Required final action:** write `planning/task-reports/T23.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T23A - Package and deploy versioned model runtimes

**Dependencies:** T09A, T10, T11, T12, T23.

**Primary files:** `deploy/spaces/text_document/`, `deploy/spaces/speech_translation/`, `models/manifest.json`, `docs/MODEL_DEPLOYMENT.md`.

**Implement:**

Package two owned Gradio ZeroGPU Spaces using the supported PyTorch placement/decorator pattern; keep ONNX ASR CPU unless compatibility is proven. Pin model weights/preprocessing/licenses/checksums and classifier or baseline artifact. Authenticate stage capabilities before expensive inference. Add loading/ready/quota/unhealthy states, checkpoints, bounded page/chunk work and version rollback. Keep portable local worker entry points with the same contracts; do not republish private data or gated weights without permission.

Package and measure the preferred versioned laptop worker as a real serving target, with 8 GB VRAM limits, explicit model lifetime, backend readiness and offline recovery. Keep both free HF deployments as separate required evidence, not a claim that their quota funds continuous judging. Stage exact Space source/artifacts/destinations for explicit publication approval; no upload is authorized by local commit permission. A blocked HF criterion cannot be erased by successful local inference.

**Acceptance checks:**

Use the eligible free account and prove owned model endpoints execute actual inference without paid APIs. Record cold/warm latency, peak RAM/VRAM, stage limits and quota attribution. Restart and model rollback preserve evidence and invalidate incompatible caches. Candidate classifier promotion/rejection is reflected in deployed config; runtime never trains on user requests.

**Required final action:** write `planning/task-reports/T23A.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T24 - Deploy and verify the full free hosted application

**Dependencies:** T20, T22, T23, T23A.

**Primary files:** `infra/render-free.yaml`, `deploy/pages/`, `docs/DEPLOYMENT_RECORD.md`, `planning/DEPLOYMENT_CHECKLIST.md`.

**Implement:**

After explicit publication approval, deploy the frontend/API/persistence with the verified selected worker backend; the preferred judging profile uses owned-laptop inference. Verify the two free HF runtimes separately as required by T23A. Use platform domains, private secrets and restricted demo accounts. Verify account plan selection without enabling paid overages. Run real text/PDF/scan/audio and bounded OSM context through the public HTTPS application; record actual release URL, backend and model manifests. Missing quota/account/model access remains a named blocker, never a paid fallback. A verified local-backed demo may be recorded before full completion; T24 remains incomplete while required dependencies/gates are unmet.

**Acceptance checks:**

Actual HTTPS login-to-assessment works with our own models and stored evidence. Verify private storage, CORS/auth, resume after sleeping runtimes and a quota-exhausted state. No paid API or service dependency is required; all claimed capabilities have live evidence.

**Required final action:** write `planning/task-reports/T24.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T25 - Run deployed acceptance and recovery checks

**Dependencies:** T24.

**Primary files:** `tests/e2e/`, `docs/RELEASE_VERIFICATION.md`, `evals/reports/release/`.

**Implement:**

Run actual browser journeys across inputs, evidence, review, clarification, arithmetic, similarity, local context, comparisons and printing. Check mobile/keyboard, refresh/failure states and synthetic labels. Exercise access denial, controlled model runtime failure, duplicate/restarted jobs and rollback/redeploy. Record live latency/free-quota consumption and verify no paid fallback, fix regressions and reconcile deployment checklist.

**Acceptance checks:**

Required journeys pass on recorded URL/release and blocking regressions are fixed. Recovery/rollback preserves inputs without duplicate published versions. Report actual measurements and any unverified language/provider behavior.

**Required final action:** write `planning/task-reports/T25.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.

## T26 - Write final implementation and readiness handover

**Dependencies:** T25.

**Primary files:** `README.md`, `docs/FINAL_IMPLEMENTATION_SUMMARY.md`, `docs/PRODUCTION_READINESS.md`, `docs/DEMO_SCRIPT.md`, `planning/TASK_STATUS.md`.

**Implement:**

Document architecture, setup/deployment/config names, supported formats/languages, model manifests, classifier promotion decision, roles, operations and limits. Map all brief requirements/features to actual implementation and evidence. Summarize evaluation, scale measurements, free quota use and zero-service-spend verification, release URL/ID and pilot-level work. Prepare five-minute demo with labeled backups; reconcile every report/tracker/CSV entry.

Update SESSION_HANDOFF.md with exact startup/test/resume commands, current commit/backend, unfinished criteria, reviewer availability and pending publication approvals. Verify local commit author/committer and absence of trailers. Distinguish model-provider quota from owned hardware constraints, and a laptop-backed hosted demo from a fully cloud-hosted deployment. A new model/account using the same workspace must be able to continue without this chat; private data/secrets must not be transferred via public Git.

**Acceptance checks:**

Every done task has substantive report/passed evidence; blocked work stays visible. Setup and actual free deployment/model evidence are discoverable. Distinguish implemented/tested/deployed/future work; no readiness or scale claim exceeds evidence.

**Required final action:** write `planning/task-reports/T26.md` with actual evidence, then update tracker/CSV and continue to the next eligible task.


## T27 - Write detailed free-deployment walkthrough

**Dependencies:** T26.

**Primary files:** `docs/DEPLOYMENT_GUIDE.md`, `explanations/DEPLOYMENT_QA.md`.

**Implement:**

Write an in-depth, numbered walkthrough for the actual free configuration: architecture and cost boundaries, accounts/Free-plan selection, local tool versions, model access/licenses, private secret setup, database migrations/policies, demo accounts, frontend/API packaging and approved deployment, native laptop worker start/stop/resume, model versions, HTTPS/CORS/auth checks, input-format verification, quota/backup/rollback/recovery, troubleshooting and demo preparation. Include exact existing commands and expected outcomes, Windows instructions and clearly distinguished optional HF deployment. Document sanitized artifact contents without publishing repository/private source data. Retain provenance and attribution.

**Acceptance checks:**

Every command references an existing file/tool and tested configuration; a clean-start rehearsal is recorded where possible. Actual verified steps, account/publication blockers and untested alternatives are distinguished. A new session can follow the guide without this chat. No secrets or invented deployment URL/results are included; publication requires explicit approval.

**Required final action:** write `planning/task-reports/T27.md`, synchronize tracker/CSV/handoff and verify local commit identity.
