Continue implementing Udyam Saathi in this SAME workspace:
C:\Users\karti\Desktop\All Desktop Apps\odyssey

First read AGENTS.md, planning/SESSION_HANDOFF.md, planning/TASK_STATUS.md,
planning/task-reports/T07.md, planning/HACKATHON_DELIVERY_PLAN.md,
planning/CODEX_EXECUTION_PLAN.md, planning/IMPLEMENTATION_TASKS.md,
planning/IMPLEMENTATION_PLAN.md and planning/FREE_MODEL_HOSTING_PLAN.md.
Then inspect Git remote, current branch, working tree and recent commits.
Do not restart the project or repeat already verified work without reason.

Authorization and fixed constraints:
- Full implementation remains authorized. The latest user asked for a local
  checkpoint, detailed README setup/progress/configuration, and this continuation
  prompt so another model/account can resume. Resume the unfinished work.
- Deadline: 18 October 2026, 06:00 IST, INCLUDING a deployed demo. Read the actual
  clock; do not treat historical event duration as remaining time.
- Zero paid APIs/hosting/trial dependence. Prefer owned RTX 5050 laptop inference
  without a provider daily allowance. Cloudflare Pages Free, Render Free,
  Supabase Free are selected, not deployed. HF targets remain separately required.
- Human language review: English/Hindi only. Mark other language quality unvalidated.
- Kartik will fill named placeholders AFTER implementation: root .env.local and
  apps/web/.env.local already exist and are ignored. Preserve any filled values;
  do not print secrets or repeat credential requests during the build. Never put
  service/database keys into VITE variables or model-worker configuration.
- Every NEW author AND committer must be Kartik Verma
  <kartikverma2204number1@gmail.com>. No co-authors/sign-offs/AI attribution trailers.
  Verify both identities after every local commit. Preserve historical commits.
- NEVER push, create a PR, upload source to a remote host, publish or deploy without
  Kartik's explicit publication approval. Local commit approval is not publication.
- Preserve original datasets. Retain third-party licenses/provenance; do not conceal
  external work. No paid fallbacks or public-free-service load tests.
- Ask about material unresolved user choices, not already decided preferences.

Actual state to resume:
- Origin https://github.com/kushal-s0/odyssey.git; branch main. Verify actual state.
- T02 scaffold/T03 contracts done. T01/T04/T05/T06 have verified local capabilities
  and named external blockers. T07 is IN PROGRESS, not done. Remaining task IDs
  must be implemented/reported; no silent scope reduction.
- T06: all 55 private files passed actual local API/PG/private-disk roundtrips,
  intact originals, 42 PDFs/109 pages/four 11-page scans and thirteen recordings.
  Actual Supabase Auth/object/free-plan checks remain unverified.
- T07 fourth migration has been applied and replayed locally. Never edit an applied
  migration. Worker contracts, expected manifest/capabilities and Jobs DB service
  exist. Four real-PG service tests pass. This is not HTTP/process/model proof.
- Start by finishing T07: scoped worker claim/input/source/heartbeat/capability
  renewal/checkpoint/publication/failure routes; scoped job progress/cancel/resume;
  startup/authorized-activity reconciliation; executable outbound owned worker
  with bounded sessions/backoff, source-hash checks, heartbeat and recovery;
  bounded Gradio enqueue/event adapter and honest separate live HF blockers.
- Current Jobs service is NOT wired to routes/startup. No native worker entry point
  exists. Do not invent a startup command. Final screening completion intentionally
  refuses success without a validated persisted assessment; T12 must add atomic
  validation/persistence. Model handlers are not implemented.
- New intents have extract/translate/structure/assess stages. For PDF/audio,
  implement resumable bounded page/chunk processing in their tasks.
- Authenticate capabilities BEFORE expensive model inference; model code must use
  restricted outbound HTTPS, never a database/service-role key. Explicitly test
  duplicate/lost responses, process termination, stale generations and sleep/quota.
- Deterministic probes prove orchestration only. Integrate actual Qwen/translation/
  ASR in their tasks and record limits. CUDA and short Qwen text inference already
  ran; model cache and .venv-model exist locally. Reuse measured pinned weights.

Verify from root (existing .venv):
.venv/Scripts/python.exe -B scripts/migrate.py --local
.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api -q
.venv/Scripts/python.exe -B -m ruff check apps/api/app tests/api
.venv/Scripts/python.exe -B -m mypy --config-file apps/api/pyproject.toml apps/api/app

Read the handoff for latest test count/processes. Docker infra-postgres-1 uses
127.0.0.1:55432 and a durable volume; private DSN/password are ignored under .local.
Tests create unique workspace temporary directories. A skipped integration check
is not a passed gate. Existing API process lacks reload; restart owned processes
before checking new routes. Never kill unrelated processes.

After T07 follow the explicit deadline order in HACKATHON_DELIVERY_PLAN.md.
Maintain one active task, actual task reports, tracker/CSV, explanations/ and
committee Q&A. Keep README truthful. Finish T27 with the in-depth deployment
walkthrough for the actual free implementation. Before any interruption/limit,
update the exact handoff, verify changes and commit coherently under Kartik only.
Do not mark unverified live integrations/deployments or model quality done.
