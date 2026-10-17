# Repository execution guide

## Identity, publication and continuation

- Latest confirmed user instruction (17 October 2026 audit): every new commit must have BOTH author and committer `Kartik Verma <kartikverma2204number1@gmail.com>`. This supersedes the pulled kushal-s0 override. Verify both after each commit. No co-authors, sign-offs or AI-attribution trailers; preserve historical commits.
- Keep commits local. Never push any branch, create a pull request, upload source to a model host, or publish/deploy changes without Kartik's explicit approval for that publication. Prepare reviewable artifacts first.
- Confirm repository remote, branch and working tree before work. This project uses `https://github.com/kushal-s0/odyssey.git`; the user changed the current branch to `second` (verified 17 October 2026). Preserve it; do not confuse this with the portfolio repository.
- Read `planning/SESSION_HANDOFF.md` and `planning/HACKATHON_DELIVERY_PLAN.md` before resuming. A new session/model/account must inspect actual state and reuse verified work; chat history is not the continuation record.
- Confirmed deadline: **18 October 2026, 06:00 Asia/Calcutta**, including a deployed demo. Current authorization is full step-by-step implementation, local commits and ongoing explanation/committee-preparation docs. Publication still requires explicit approval.
- Kartik prefers inference without an expiring provider allowance and can keep his laptop running. Prefer a verified owned-laptop worker for judging; free Hugging Face deployment remains a separately verified target. Do not describe a laptop-backed deployment as fully cloud hosted or unlimited.
- Available human language review: English and Hindi only. Other languages remain unvalidated unless a reviewer becomes available.

This repository contains the uploaded Tata STRIVE problem statement/datasets and a Codex implementation plan. Preserve the original source files.

## Budget and model requirements

- The user requires free deployment and no paid APIs. Read `planning/FREE_MODEL_HOSTING_PLAN.md`; do not restore old hosted-model/paid-worker assumptions or add paid fallbacks.
- The user confirmed an eligible Hugging Face account. Verify actual free Space provisioning, model access and quotas; no paid plan or GPU purchase is authorized.
- Latest hackathon priority supersedes the old mandatory 29-task release gate: deliver the actual problem-statement features first. T09A already ran and rejected promotion; do not spend more demo time retraining it. Secondary HF deployments and large scale experiments are deferred, not prerequisites for the owned-laptop demo. Preserve their reports as unfinished/deferred and do not claim them completed. Existing open-weight models are self-hosted, not represented as models trained by this project.
- Distinguish quota-limited free deployment from scalability demonstrated on local/owned hardware. Do not load test public free services.

## Current priority: usable hackathon solution

- User explicitly redirected work away from production architecture toward solving the brief quickly. Read `planning/HACKATHON_RESET.md` first. Restore the current machine, then prioritize reliable text/PDF/audio understanding, translation, assessor view, similar ideas, local context and four comparison views.
- Use Supabase as the one application database/auth/storage service. Local PostgreSQL/Docker are optional developer tests; do not require users to run an extra database. Do not add MySQL/Mongo or migrate working persistence merely because those tools are installed.
- Retain useful implemented evidence/scoring/privacy/worker code. Do not rewrite the stack, add more worker platforms or expand documentation before the core demo works. Keep README short; advanced setup belongs in docs/SETUP.md.

## When implementing the application

- Read `planning/CODEX_EXECUTION_PLAN.md`, `planning/TASK_STATUS.md` and `planning/IMPLEMENTATION_TASKS.md` before editing application code. Use `planning/IMPLEMENTATION_PLAN.md` for product/architecture details.
- Follow the user's requested scope. A request to revise the plan does not authorize starting application implementation. A request for the full implementation authorizes continuing through eligible tasks without asking for routine task-by-task confirmation.
- Implement and verify one task at a time. After each task, write `planning/task-reports/TXX.md` using `planning/task-reports/TEMPLATE.md`, then update the status tracker and CSV.
- Do not mark a task done until its required checks pass and its report exists. Record missing credentials, unavailable infrastructure and unverified live behavior as specific blockers; continue independent work where possible.
- On resumption, inspect the latest report and actual code state. Preserve user changes and do not repeat already verified work unnecessarily.
- Keep source data private, APIs stateless, long-running work durable, and evidence/revisions traceable. Apply the explicit access, recovery, scalability and deployment gates in the execution plan.
- Never claim mocked provider behavior is a live integration, a container build is a deployment, or an unmeasured scaling target is achieved capacity.

## Implementation documentation

- Maintain `explanations/` with code/module guides, data flow, design choices, limitations and committee questions as each task progresses. Preserve required licenses and source provenance for external models/data/resources; do not conceal third-party work or make unsupported originality claims.
- Finish with T27: detailed step-by-step deployment instructions for the actual free configuration, including prerequisites, secret setup, build/deploy, owned-worker startup, verification, recovery and troubleshooting.

- Latest credential preference: one ignored root .env.local for local API/frontend/launcher settings. Existing browser values were migrated without overwriting filled root values; Vite exposes only VITE_ names. A separately hosted worker may use a narrow worker-only file. Kartik is configuring Supabase privately; do not repeatedly request credentials. Record specific failed connection checks and continue independent work. Supabase login only; no local/demo Auth bypass.
