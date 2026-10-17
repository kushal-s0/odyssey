# Session handoff - read first after a model/session/account change

Updated: 17 October 2026, Asia/Calcutta. This file records repository state, not a promise of completion.

## Current instruction and next action

**Latest override, 17 October 2026:** the user requested the next four deadline-order
tasks, T09 → T09A → T12 → T08, with local commits as
`kushal-s0 <kushal.soni@somaiya.edu>` for BOTH author and committer. This supersedes
the earlier Kartik-only identity below; historical commits must remain unchanged.
Actual current branch is `second`; preserve it. Publication remains unapproved.
T09 is blocked after actual English inference passed; T09A is now active.
See task-reports/T09.md and evals/reports/feasibility/owned-text.json. Both model
downloads are hash-verified; .venv-model/CUDA are ready. English HTTP/worker
structure: 23.601 s and 4.36 GB allocated VRAM. Mixed language stops on denied
gated translation; adversarial extraction stops for review. API suite 126 passed.
No provisioning sessions remain. The following provisioning notes are historical.
Its local parser/API persistence checks pass; actual inference
is pending isolated model environment/weight downloads on this machine's
RTX 3050 6 GB, which differs from the older RTX 5050 evidence. IndicTrans2
access checks returned HTTP 401; no paid/hosted fallback is authorized.

Running provisioning operations at this checkpoint: resumable official CUDA
wheel and Qwen weight downloads in ignored `.local/range-downloads`, with final
upstream SHA-256 required. Earlier full downloads stalled/truncated; no failed
checksum was bypassed. Existing HF token is read in memory only. Automatic
approval review rejected copying it into extra files; that mutation was removed
and in-memory access checks were approved. No credentials were changed/copied.
Read the latest T09 report before resuming; the older T07 checkpoint remains below.

Current T09 partial checks: full API suite 122 passed/no skips in 44.75 seconds;
strict mypy 47 files passed. Native range-download sessions 45461 (CUDA wheel)
and 12498 (Qwen weights) are current, not the old interrupted full-download
sessions. Their ignored scripts `.local/download_ranges.py torch` / `qwen`
resume already complete chunks and require upstream checksums. Do not treat a
partial cache file as ready. Next: install the verified local wheel, install
`models/requirements-text.txt` plus the API package in `.venv-model`, complete
model cache provisioning, then run `scripts/verify_owned_text.py` before reporting
actual inference. Public artifact metadata is safe; never print private tokens.

**Authorized now:** implement the requested next four tasks, maintain explanations/ and committee Q&A, and commit locally using the latest identity above. No push/publication is authorized.

Next action: read the rolling checkpoint and latest task report. Current branch is `second` (changed by the user since T07); preserve it.

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

- Updated 17 October 2026, 18:17 Asia/Calcutta. Latest user request:
  resume unfinished T07 from saved state, preserve credentials/work, commit
  locally without co-authors, no publication. Full earlier authorization remains.
- Current workspace is `C:\Users\Kushal\Documents\kushal soni\college folder\odyssey`;
  old Kartik desktop paths/processes/cache references above are historical.
  Origin remains `https://github.com/kushal-s0/odyssey.git`, branch `main`.
- T07 local runtime is implemented and verified. Tracker state is `blocked`
  solely for required live HF enqueue/auth/quota/sleep/runtime compatibility.
  No task marked done without those gates. T02/T03 remain the two done tasks.
  No T09 implementation began; next independent work is T09 under the explicit
  owned-worker allowance, retaining outstanding HF/Supabase/model gates.
- New worker/job routes, source hash checks, capability renewal, invocation
  exclusion, shared capacity, cancel/resume, startup/activity reconciliation,
  native sessions and Gradio adapter/CPU wrapper are documented in
  `docs/WORKER_OPERATIONS.md`. Fifth migration applied/replayed; never edit it.
- Executable exists: `.venv/Scripts/python.exe -B -m app.worker --help`.
  `--probe` is synthetic only and cannot claim screening jobs. Real handlers
  remain T09–T12. Final screening success still requires an assessment row;
  T12 must implement validated atomic persistence. No model inference in T07.
- Actual native PG/loopback HTTP/subprocess tests prove checkpoint recovery after
  worker termination/API restart, fencing, duplicate/lost publication responses,
  authorization/source integrity, timeout and capacity. Simulated Gradio HTTP
  proves adapter behavior only, not live HF integration or quota.
- Last full regression: 110 passed/no skips in 34.20 seconds. Focused worker
  checks: 24 passed in 7.83 seconds. Ruff passed; strict mypy 40 files passed.
  Schema/types regenerated after offline endpoint. Frontend types/lint/build
  passed; final regeneration was checked again before commit. Existing AnyIO
  deprecation and npm's one high advisory remain T21 triage items.
- This machine initially lacked .venv, frontend dependencies, Docker, local PG,
  .venv-model and the previous model cache. Recreated API/frontend dependencies
  and private portable PostgreSQL 16.15 with local pgvector 0.8.1. See sources
  record for licenses and MinGW compatibility shim/large-code-model adaptation.
  First native build/load failures were repaired before migrations/tests.
  This native test build is not a release/deployment artifact.
- Local PostgreSQL remains running on `127.0.0.1:55432`. Native data is ignored
  `.local/native-postgres-data`; credentials are `.local/test-database-url` and
  `.local/postgres.env` (never print). No Docker container/volume exists here.
  Start if stopped (root PowerShell, may need sandbox escalation):
  `& '.local/native-postgres/pgsql/bin/pg_ctl.exe' -D '.local/native-postgres-data' -l '.local/native-postgres.log' -o '-h 127.0.0.1 -p 55432' start`
  Stop only this owned server when desired:
  `& '.local/native-postgres/pgsql/bin/pg_ctl.exe' -D '.local/native-postgres-data' -m fast stop`
  Do not run Docker on the occupied port or delete data. Reuse the private DSN.
- Temporary test API/worker processes are stopped; no preview/API daemon was
  started. Earlier exec sessions in this file no longer identify live processes.
- Existing `.env` and original archives were untouched. Missing ignored
  `.env.local`, `apps/web/.env.local` and `.env.worker.local` were prepared from
  templates only when absent. API reads `.env.local`; worker reads its dedicated
  `.env.worker.local`. Preserve filled values; no credentials were printed.
- Pre-existing tracked `.tools/t01` deletions/inaccessible paths belong to the starting worktree;
  preserved and excluded from the T07 commit. Do not indiscriminately git add.
- Repository config currently identifies Kushal; new commits must explicitly set
  BOTH Kartik identities and verify them. No co-author/sign-off/AI trailers.
  Inspect actual latest log for the commit; do not invent a self-referencing hash.
- No push, PR, remote upload, deployment/publication or paid service occurred.
  Pending external prerequisites remain private configuration, model access,
  owned Space provisioning and publication approval; no repeated credential
  requests. Public Nominatim remains disabled. Human review English/Hindi only.
