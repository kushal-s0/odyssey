# Session handoff — current checkpoint

Updated: 17 October 2026, 20:36 Asia/Calcutta. Actual repository evidence is authoritative.

## Current instruction and next action

The user requested an immediate local checkpoint because the session limit is
near; the next agent will continue. Stop implementation after saving this state.
Earlier four-task scope was T09 -> T09A -> T12 -> T08. T09 is blocked, T09A/T12
are done locally, and T08 is in progress with nine browser journeys passing.
Read planning/task-reports/T08.md before editing. Finish its remaining review
and browser regressions; do not redo already verified work without a reason.

Remote: https://github.com/kushal-s0/odyssey.git. Current branch: second.
Both new author AND committer: kushal-s0 <kushal.soni@somaiya.edu>, no co-author,
sign-off or AI trailers. This latest user override supersedes older Kartik-only
instructions. Keep all commits local. No push/PR/source upload/deployment approved.

## Verified work to reuse

- Local commits before this checkpoint: 9ce064d (partial text), b0de693 (owned
  inference/Windows transport), 7789faf (relevance experiment), 643df9d (T12).
  Inspect Git for the subsequent applicant-checkpoint commit; do not invent its hash.
- T12 full API regression: 138 passed/no skips, 35.49 s; strict mypy 53 files
  and Ruff passed. Actual English/adversarial owned-worker assessments persisted
  in 51.159/42.137 s. Scores are API-computed, missing evidence null, insufficient
  headline withheld. Native handler: app.pipeline.run:handler.
- T09A actually fitted frozen MiniLM + logistic regression: 102 proposed QA pairs,
  11 English-folder PDFs, five coarse family groups. Zero independently reviewed
  labels. Repeated artifact hash stable; JSON export parity/group isolation pass.
  Explicit promotion rejection: rules-cosine-baseline-v1 remains advisory serving.
- T08 actual Edge/API/PG/private-disk/Qwen check passed nine journeys in 96.849 s:
  lost accepted response + double-submit recovery, persisted text assessment,
  evidence display, refresh, PDF upload failure/retry and identical original
  download, denied-mic WAV fallback, real MediaRecorder/WebM upload, mobile/
  keyboard/Indic input and private-UI removal at sign-out. Exactly four new
  submissions verified, only text assessed. Auth provider replies and microphone
  input are labeled fixtures, NOT hosted Supabase evidence.
- T08 typecheck/lint and production build passed; Vite build 18.22 s.
  Safe report: evals/reports/applicant-ui.json. Ignored screenshots under
  .local/applicant-ui-<run>/. Ephemeral synthetic session token removed.
  Harness stopped its own worker/Vite/API and cleaned synthetic DB data.
- No application/model is deployed. PDF/audio processing remains T10/T11.

## Finish T08 next

1. Review a pending-microphone race: when an old audio file is selected, a submit
   during unresolved getUserMedia permission may submit the old file. Current
   SubmitIdea guard queries the recording alert. Use a synchronous activity ref/
   callback covering permission request and recording, and add a browser case.
   This is a known review item, not a claim that the race was tested.
2. Run existing landing/auth browser regressions at the fixture Vite origin.
   verify_applicant_ui.py currently invokes only browser-applicant.mjs.
   Extend the harness to invoke browser-smoke.mjs/browser-auth.mjs before its
   cleanup with PREVIEW_URL/AUTH_PREVIEW_URL set to its web origin. Existing
   browser-auth uses HTTP fixtures; keep that distinction.
3. Rerun checks justified by those edits, finish T08 report/status/CSV and commit
   locally. Do not mark T08 done just because the new nine-case check passed.

## Runtime, privacy and blockers

- Current hardware RTX 3050 Laptop 6144 MiB VRAM, ~16.85 GB RAM. Older RTX 5050/
  8 GB/24 GB notes below are historical. Qwen peak allocated VRAM ~4.39 GB.
- Native PG16.15 + pgvector0.8.1 is on loopback 55432. Private ignored DSN:
  .local/test-database-url. API/tests: .venv. CUDA/model environment: .venv-model.
  Model cache downloads are complete, pinned and upstream-hash verified.
  No downloads or long-running verification sessions remain.
- If PG stops: .local/native-postgres/pgsql/bin/pg_ctl.exe -D
  .local/native-postgres-data -l .local/native-postgres.log -o
  '-h 127.0.0.1 -p 55432' start (PowerShell command, escalation may be needed).
- Run real model/browser harnesses separately from DB tests. Shared worker
  capacity intentionally one. Freeze manifest/code while child-process tests
  run. An overlapping/changing run produced rejected claims; frozen rerun passed.
- T09: IndicTrans2 config access returned 401. Custom code not accessible/reviewed.
  Mixed source preserved with model_access_denied. Longer proposal still
  paraphrases exact quotes and stops needs_review despite bounded repair.
  Human English/Hindi review not performed; other languages unvalidated.
- Hosted Auth/database/private storage and live HF enqueue/quota/sleep remain
  unfinished T04–T07/T01 gates. Local synthetic verification is not deployment.
- Root/frontend/worker credentials remain private/ignored and preserved. Backend
  .env.local/worker placeholders still need real operator values for normal use.
  Never print secrets. Approval review rejected copying an existing HF token to
  extra files; that mutation was removed. Read existing token in memory only.
- Preserve original private archives and unrelated pre-existing .tools/t01
  deletion entries (135 historical entries); never stage or repair them for this task.
  evals/manifests/dataset.json showed only normalized line-ending status after
  restoring its historical bytes; current-tool inventory is separately recorded
  in evals/reports/feasibility/current-dataset.json.
- Deadline remains 18 October 2026 06:00 Asia/Calcutta. No paid fallback.

## Historical continuation record

Retained below for provenance. Current checkpoint above supersedes old active
tasks, running-session IDs, pending-download notes, identities and hardware claims.

## User decisions that persist

- Working deployed demo deadline: **18 October 2026, 06:00 Asia/Calcutta**.
- Zero paid service/API spend; prefer a route without expiring inference allowance. Kartik can keep his laptop online for training/inference. Prefer the owned worker after a measured smoke test; retain HF deployment and honest quota blockers separately.
- Human language review: English and Hindi only. Other corpus languages remain unvalidated.
- Latest override: every new author AND committer is **kushal-s0 <kushal.soni@somaiya.edu>**. No co-authors, sign-offs or AI-attribution trailers. Verify both identities after every commit. Never rewrite historical commits for attribution.
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
