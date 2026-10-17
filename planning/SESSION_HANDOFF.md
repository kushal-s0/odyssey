# Session handoff - read first after a model/session/account change

Updated: 17 October 2026, Asia/Calcutta. This file records repository state, not a promise of completion.

## Current instruction and next action

**Authorized now:** implement the full backlog step by step, maintain explanations/ and committee Q&A, add final T27 deployment instructions and commit locally as Kartik. No push/publication is authorized.

Next action: read the rolling checkpoint and latest task report below. Current branch is `main` (changed by the user since the review); preserve it.

## User decisions that persist

- Working deployed demo deadline: **18 October 2026, 06:00 Asia/Calcutta**.
- Zero paid service/API spend; prefer a route without expiring inference allowance. Kartik can keep his laptop online for training/inference. Prefer the owned worker after a measured smoke test; retain HF deployment and honest quota blockers separately.
- Human language review: English and Hindi only. Other corpus languages remain unvalidated.
- Every new author AND committer: **Kartik Verma <kartikverma2204number1@gmail.com>**. No co-authors, sign-offs or AI-attribution trailers. Verify both identities after every commit. Never rewrite historical commits for attribution.
- No push, PR, remote source upload or deployment without explicit publication approval. Local commit approval is not publication approval.
- Ask before resolving material uncertainty about scope, external actions or missing prerequisites. Do not invent an answer or ask for credentials in chat/committed files.

## Verified starting state

- Workspace: `C:\Users\karti\Desktop\All Desktop Apps\odyssey`.
- Origin: `https://github.com/kushal-s0/odyssey.git`; branch at review: `master`; current branch: `main`. Verify these again; do not force-checkout if Kartik changed them.
- Pre-review HEAD: `d2fb9a7` (historical author/committer kushal-s0; preserve). Local Git identity was already configured as Kartik with the email above. Use `git log -1` for the latest planning commit; do not embed a self-referencing guessed hash here.
- Initial review state had no application scaffold/reports. Current state: T02 scaffold completed; T01 partial report and actual model feasibility evidence exist. Use TASK_STATUS.md for the live count, not historical planning snapshots. No cloud deployment or trained classifier is verified.
- Original sources: organizer PDF plus three ZIP archives; preserve intact. Independent read-only audit confirmed 55 submissions, 42 PDFs/109 pages, four 11-page scans and 13 recordings. See [PROJECT_REVIEW.md](PROJECT_REVIEW.md). Audit observations are not completion of T01's script/live acceptance checks.
- Hardware: RTX 5050 Laptop GPU, 8151 MiB VRAM, driver 592.82; system memory 24,841,998,336 bytes. CUDA/framework/model compatibility, latency, model fit and sustained uptime unverified. Docker engine was unavailable at review; T04 started it and tested actual PostgreSQL. T01 follow-up ran local CUDA/Qwen inference; see reports.
- Original datasets and `.tools/` are already tracked. Do not use `git add .` indiscriminately or assume `.gitignore` removes tracked data. Prepare sanitized build/publication inputs without rewriting history.

## Open prerequisites and decisions

| Item | Known | Needed before dependent behavior |
|---|---|---|
| Laptop inference | CUDA and bounded Qwen text/scan execution measured locally; full worker pipeline incomplete | Compatible pinned framework, permitted model downloads, measured text/scan/audio/translation execution and authenticated worker recovery |
| Hugging Face | User will fill token after the build; initial three gated probes HTTP 401 | Actual account access/condition acceptance, two Space provisioning, enqueue/auth and quota measurements; do not assume verified |
| Cloud services | New projects; user will fill configuration after the build | Account/project access, real Free plans, connection/auth/storage checks and publication approval |
| Publication | No publication approved in this session | Prepare exact sanitized artifacts/destinations, then obtain explicit approval; no push as a workaround |
| Language quality | English/Hindi reviewer available | Reviewed labels/transcripts; other four languages need fluent reviewers or an explicit unvalidated status |
| Location provider | Policy reviewed | Public Nominatim remains disabled until Kartik explicitly opts in after reading its restrictions; licensed snapshot/confirmed coordinates can be used |
| Implementation | Full backlog authorized | Execute tasks with reports and maintain explanations/ |

## Resume procedure

1. Read `AGENTS.md`, this file, `TASK_STATUS.md`, latest task report if any, `HACKATHON_DELIVERY_PLAN.md`, `CODEX_EXECUTION_PLAN.md`, `IMPLEMENTATION_TASKS.md`, `IMPLEMENTATION_PLAN.md` and `FREE_MODEL_HOSTING_PLAN.md`.
2. Run `git remote -v`, `git branch --show-current`, `git status --short`, `git log -3 --format=fuller`, `git config user.name` and `git config user.email`. Inspect changes instead of overwriting them. Compare actual artifacts with reports.
3. Read the confirmed scope above and any later user instruction. Recheck current IST time against the fixed deadline. Ask only for unresolved material choices; do not ask again about confirmed deadline/identity/language availability.
4. Follow the explicit deadline task order. Keep one active task, verify each real criterion, write/update its report and synchronize tracker/CSV. For partial work record exact blocker and next safe action. Never promote fixture checks to live evidence.
5. Preserve a checkpoint before a context reset, account/model switch, long operation or final response: changed files, last verified command/result, failing check, active process/session, dependency/config names, exact next action and pending approval. Commit coherent authorized changes locally. Keep secrets out of the handoff.
6. On a different machine/account, local unpushed commits and private data do not arrive automatically. Use the same workspace or a Kartik-approved private transfer; never publish the repo to make handoff easier. Re-provision local secret configuration privately; document names only.

Pasteable prompt for a later session:

```text
Read AGENTS.md and planning/SESSION_HANDOFF.md in this workspace. Inspect
the repository identity, branch, working tree, task status and latest report.
Preserve Kartik's changes and existing historical attribution. Commit only
as Kartik Verma <kartikverma2204number1@gmail.com>, author and committer,
without trailers. Never push, publish or deploy without explicit approval.
Follow the deadline/free-budget/language-validation decisions recorded in
the handoff. Continue only the implementation scope Kartik has authorized;
full implementation is now authorized; use the tracker for the next task.
Resume from actual evidence and the exact next action, not a fresh rebuild.
```

## Rolling checkpoint (authoritative current resume state)

- Latest user request: commit current code locally, document all startup requirements/configuration/progress in README and generate a paste-ready next-agent prompt before session limits. Full implementation remains authorized, but this is a partial checkpoint; remaining backlog is not complete.
- Read [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md) for the full pasteable continuation instruction. README now contains current preview, environment/API-key table, local DB startup, judging account setup and check commands.
- Current branch main; verify actual HEAD/log for the latest checkpoint commit. Earlier commits: 93d5786 authentication, e492712 uploads/submissions, 59839c5 shared test-fixture cleanup. All were checked as Kartik for both author/committer, no trailers. No push or remote deployment.
- Completed tracker tasks remain T02/T03. T01/T04/T05/T06 have local verified capabilities but specific hosted/gated prerequisites remain blocked. T07 is in_progress; see task-reports/T07.md. Its unfinished code is not only an external credential blocker.
- T07 code: app/contracts/worker.py; app/worker/{manifest,capabilities}.py; app/services/jobs.py; fourth SQL migration 202610170004_worker_runtime.sql; four-stage creation in routes/submissions.py; tests/api/test_worker_service.py. Compatible claims recover a lost response for the same worker without consuming a second attempt. DB service checks stage generations and duplicate outputs. Expected-artifact manifest is not deployed-model evidence.
- Fourth migration applied and replayed locally. Never modify applied migrations; add a new version if needed. Tests dynamically count migrations. Service-only worker_runtimes table has RLS/no browser grants.
- T07 STILL MISSING: routes/internal_jobs.py and routes/jobs.py; HTTP auth/input/source/capability renewal/checkpoint/publish/failure; job progress/cancel/resume; startup/activity reconcile wiring; executable native outbound worker; Gradio adapter/event recording; real HTTP process termination/restart recovery; actual HF checks. No executable worker startup command exists. Final official screening completion refuses success without an assessment row: T12 must validate and persist the final assessment atomically.
- Next action: inspect Jobs service and new contracts, wire restricted worker/user job endpoints, then build the outbound worker and actual process-recovery checks. Do not call synthetic service probes model inference or T07 completion. After that follow the explicit deadline order through T27.
- Last standalone new checks: 4 worker-service tests passed; ruff over app/tests passed; strict mypy passed 33 source files; fourth migration replay passed. Final full regression: 90 passed/no skips in 61.11 seconds; one existing AnyIO/Starlette deprecation. Last frontend types/lint/build passed T06; no T07 browser code change. Regenerate OpenAPI/types after adding actual worker/job routes.
- T06: actual 55-file API/PG/explicit-disk roundtrip passed; byte-identical authorized downloads; 42 PDFs/109 pages/four 11-page scans/13 recordings; original archive hashes unchanged. Synthetic WebM/WAV/MP3 and input rejection/ownership/idempotency/transaction rollback/cancellation/cleanup passed. T06 baseline full suite 86 passed/no skips. Supabase object operations remain unverified. T05 crypto/access/browser fixtures passed; hosted Auth remains unverified.
- Tests use tests/api/conftest.py to create a fresh ignored .local/pytest-runs/GUID temp directory. The local PostgreSQL fixture is shared there. Source test data is private; corpus tests emit metadata only. Existing AnyIO/Starlette test-client deprecation remains to triage in hardening.
- Local resources last started: old API exec 64257 at 127.0.0.1:8000 (NO reload, stale imports); normal Vite exec 6702 at 127.0.0.1:5173; Docker infra-postgres-1 on loopback 55432, durable infra_udyam-test-pg volume. Check actual processes: sessions may not survive another account/client. Restart only owned processes. No temporary synthetic-auth preview remains.
- Local database DSN/password: ignored .local/test-database-url and .local/postgres.env; never print values. Tests use an explicit local disk adapter; production forbids local storage. Root .env.local and apps/web/.env.local contain named blank placeholders; user will fill AFTER implementation. Preserve supplied values; do not ask again during build.
- Model environment .venv-model and ignored .cache/huggingface/hub contain pinned GPU dependencies and Qwen weights. CUDA arithmetic passed. Qwen text first/warm ~8.6/7.4 seconds, ~4.29 GB peak VRAM; handwriting ~39.7 seconds, ~4.34 GB, hit 192-token cap and is not quality-validated. Raw output/image are private .local files; public metadata is evals/reports/feasibility/. Gated AI4Bharat downloads, MiniLM inference, full language evaluation and HF provisioning remain unverified.
- API venv now has pypdf 6.21.1 / av 16.0.1 for upload validation; historical T01 inventory used pypdf 6.1.1. Model/inspection locks have distinct purposes; do not blindly install the Windows CUDA lock into API/Linux runtimes.
- Pending approvals: external publication and informed public-Nominatim opt-in. No paid service or publication is authorized. Preserve licenses/provenance, original archives and all prior user changes.
