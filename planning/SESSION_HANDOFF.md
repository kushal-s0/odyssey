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
| Laptop inference | Owned machine available; CUDA environment installation active | Compatible pinned framework, permitted model downloads, measured text/scan/audio/translation execution and authenticated worker recovery |
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

## Rolling checkpoint (replace as real work progresses)

- Current scope: full implementation, explanations/ and final T27 deployment walkthrough; 29 total tasks.
- Completed tasks: T02 scaffold and T03 typed contracts/rubric; see their task reports. T01 remains blocked on gated/HF-specific and remaining language/model integration checks.
- Active application task: T07; T05/T06 local implementation verified, hosted Auth/private-object checks blocked.
- Last checks: 37 API tests including eight real PostgreSQL checks, ruff/mypy (16 source files), checksum migration replay and real owned-container dump/restart/restore passed. T03 generated OpenAPI/TypeScript and frontend lint/build passed. T02 clean lock restores and browser smoke passed at 1440/390 viewport widths. No configured private values or source archives in frontend bundle; API runtime lock excludes model frameworks.
- Live local resources: API exec 64257 (port 8000, no reload); Vite exec 6702 (port 5173); Docker infra-postgres-1 on loopback 55432, volume infra_udyam-test-pg. Local DB URL/password in ignored .local/test-database-url and .local/postgres.env. Stop/restart owned API before checking new routes. No cloud deployment.
- Model setup sessions 38311/41110/59081 completed. CUDA arithmetic passed. Pinned Qwen text first/warm inference passed JSON parsing (~8.6/7.4 sec); handwriting inference ran (~39.7 sec) but hit 192-token cap and has no reviewed quality reference. Public metrics are in evals/reports/feasibility; raw private output is .local/qwen-feasibility.private.json. Append these facts to T01 without claiming it complete.
- T01 CUDA/Qwen follow-up is documented in task-reports/T01.md, scripts/model_feasibility.py, evals/reports/feasibility/ and models/requirements-local.lock. No weights/private outputs belong in Git.
- Latest user decision: prepare environment variable placeholders; user will fill values only after the build. Root .env.local and apps/web/.env.local now exist with named blank placeholders. Do not ask for credentials again during implementation. Hosted/gated live checks remain blocked until values are supplied afterward. Preserve any filled values.
- Pending approvals: external publication and public Nominatim opt-in only; implementation is authorized.
- Next action: T07 authenticated owned-worker pull jobs/capabilities, progress/retries/cancellation and process recovery. T06 report: 86 API tests passed (no skips), actual 55-file upload/submission/download corpus roundtrip byte-identical; 42 PDFs/109 pages/four 11-page scans +13 recordings; source archive hashes unchanged. Synthetic WebM/WAV/MP3, spoofing/limits/ownership/idempotency/rollback/cleanup passed. Ruff/mypy 28 source files and frontend generated types/lint/build passed. Use fresh --basetemp under .local/pytest-runs to avoid Windows global temp permissions. Supabase object operations remain unverified. T05 report: 66 API tests passed (no skips), ruff/mypy 21 files, frontend lint/build, desktop/mobile dialog, fixture login/logout/expiry and server-secret sentinel scan passed. No hosted Auth account checks. T04 actual local migrations/RLS/concurrent claim/fencing/restart/restore passed; hosted Supabase plan/connection/private-object operations remain unverified. User asked to configure new Free project in ignored root .env.local; keep secrets out of chat/output.
