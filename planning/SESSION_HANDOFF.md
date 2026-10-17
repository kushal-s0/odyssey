# Session handoff - read first after a model/session/account change

Updated: 17 October 2026, Asia/Calcutta. This file records repository state, not a promise of completion.

## Current instruction and next action

**Authorized now:** analyze the project and revise tasks/docs for the deadline and reliable continuation; commit those changes locally as Kartik. **Application implementation has not been requested in this session.** Do not start T01/T02 implementation or publish anything merely by reading the start prompt.

Next action after the documentation review: present the findings and local commit. If Kartik subsequently requests implementation, read the files below, inspect actual state and begin T01's reproducible dataset/model feasibility work. No model weights, application packages, cloud resources or credentials were provisioned during this review.

## User decisions that persist

- Working deployed demo deadline: **18 October 2026, 06:00 Asia/Calcutta**.
- Zero paid service/API spend; prefer a route without expiring inference allowance. Kartik can keep his laptop online for training/inference. Prefer the owned worker after a measured smoke test; retain HF deployment and honest quota blockers separately.
- Human language review: English and Hindi only. Other corpus languages remain unvalidated.
- Every new author AND committer: **Kartik Verma <kartikverma2204number1@gmail.com>**. No co-authors, sign-offs or AI-attribution trailers. Verify both identities after every commit. Never rewrite historical commits for attribution.
- No push, PR, remote source upload or deployment without explicit publication approval. Local commit approval is not publication approval.
- Ask before resolving material uncertainty about scope, external actions or missing prerequisites. Do not invent an answer or ask for credentials in chat/committed files.

## Verified starting state

- Workspace: `C:\Users\karti\Desktop\All Desktop Apps\odyssey`.
- Origin: `https://github.com/kushal-s0/odyssey.git`; branch at review: `master`. Verify these again; do not force-checkout if Kartik changed them.
- Pre-review HEAD: `d2fb9a7` (historical author/committer kushal-s0; preserve). Local Git identity was already configured as Kartik with the email above. Use `git log -1` for the latest planning commit; do not embed a self-referencing guessed hash here.
- Application implementation: no scaffold, no task reports other than `TEMPLATE.md`, no trained artifacts or recorded deployment. **0/28 tasks done.** Prior T01 `in_progress` was a stale scope marker with no implementation report; this review reconciles it to pending rather than claiming completion.
- Original sources: organizer PDF plus three ZIP archives; preserve intact. Independent read-only audit confirmed 55 submissions, 42 PDFs/109 pages, four 11-page scans and 13 recordings. See [PROJECT_REVIEW.md](PROJECT_REVIEW.md). Audit observations are not completion of T01's script/live acceptance checks.
- Hardware: RTX 5050 Laptop GPU, 8151 MiB VRAM, driver 592.82; system memory 24,841,998,336 bytes. CUDA/framework/model compatibility, latency, model fit and sustained uptime unverified. Docker engine was not available. No model inference ran.
- Original datasets and `.tools/` are already tracked. Do not use `git add .` indiscriminately or assume `.gitignore` removes tracked data. Prepare sanitized build/publication inputs without rewriting history.

## Open prerequisites and decisions

| Item | Known | Needed before dependent behavior |
|---|---|---|
| Laptop inference | Owned machine available; GPU/RAM inspected | Compatible pinned framework, permitted model downloads, measured text/scan/audio/translation execution and authenticated worker recovery |
| Hugging Face | Prior plan records eligible account; free allowance documented | Actual account access/condition acceptance, two Space provisioning, enqueue/auth and quota measurements; do not assume verified |
| Cloud services | Cloudflare/Render/Supabase are selected candidates | Account/project access, real Free plans, connection/auth/storage checks and publication approval |
| Publication | No publication approved in this session | Prepare exact sanitized artifacts/destinations, then obtain explicit approval; no push as a workaround |
| Language quality | English/Hindi reviewer available | Reviewed labels/transcripts; other four languages need fluent reviewers or an explicit unvalidated status |
| Location provider | Policy reviewed | Public Nominatim remains disabled until Kartik explicitly opts in after reading its restrictions; licensed snapshot/confirmed coordinates can be used |
| Implementation | Planning update only | Subsequent request to implement the full backlog or a named task |

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
if it is still planning-only, do not begin application implementation.
Resume from actual evidence and the exact next action, not a fresh rebuild.
```

## Rolling checkpoint (replace as real work progresses)

- Current scope: project review and planning revision.
- Active application task: none; next T01 if implementation is requested.
- Last verification: inline Python documentation checks passed for 28 unique task IDs, dependency order, index/CSV agreement, pending statuses and report paths; 53 relative Markdown links resolved. `git diff --check` passed after whitespace repair. Source archives/inventory and .tools have no intentional changes. No task acceptance check is claimed by these documentation checks.
- App tests run: none; no application exists.
- Active application processes/cloud deployments: none started by this review.
- Pending approvals: application implementation and all publication remain unauthorized; public Nominatim opt-in unresolved.
- Next implementation command: first inspect repository/tool availability, then create T01's repeatable inventory and feasibility artifacts if authorized; no runnable project command exists yet.
