# Repository execution guide

## Identity, publication and continuation

- Latest user override (17 October 2026): every new commit must have both author and committer `kushal-s0 <kushal.soni@somaiya.edu>`, matching the configured Git identity. Verify both after committing. No co-author, sign-off or AI-attribution trailers. Preserve historical attribution. This supersedes the earlier Kartik-only identity requirement.
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
- Complete T09A (small relevance-model experiment) and T23A (versioned model deployment) within the 29-task backlog (including final T27 deployment walkthrough). Existing open-weight models are self-hosted, not represented as models trained by this project.
- Distinguish quota-limited free deployment from scalability demonstrated on local/owned hardware. Do not load test public free services.

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

- Latest credential preference: prepare named placeholders in ignored root and frontend .env.local files. Kartik will fill values after implementation. Do not repeat credential requests during the build; continue local/independent checks and record hosted/gated verification blockers honestly. Preserve existing filled values.
