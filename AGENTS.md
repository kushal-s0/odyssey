# Repository execution guide

This repository contains the uploaded Tata STRIVE problem statement/datasets and a Codex implementation plan. Preserve the original source files.

## Budget and model requirements

- The user requires free deployment and no paid APIs. Read `planning/FREE_MODEL_HOSTING_PLAN.md`; do not restore old hosted-model/paid-worker assumptions or add paid fallbacks.
- The user confirmed an eligible Hugging Face account. Verify actual free Space provisioning, model access and quotas; no paid plan or GPU purchase is authorized.
- Complete T09A (small relevance-model experiment) and T23A (versioned model deployment) within the 28-task backlog. Existing open-weight models are self-hosted, not represented as models trained by this project.
- Distinguish quota-limited free deployment from scalability demonstrated on local/owned hardware. Do not load test public free services.

## When implementing the application

- Read `planning/CODEX_EXECUTION_PLAN.md`, `planning/TASK_STATUS.md` and `planning/IMPLEMENTATION_TASKS.md` before editing application code. Use `planning/IMPLEMENTATION_PLAN.md` for product/architecture details.
- Follow the user's requested scope. A request to revise the plan does not authorize starting application implementation. A request for the full implementation authorizes continuing through eligible tasks without asking for routine task-by-task confirmation.
- Implement and verify one task at a time. After each task, write `planning/task-reports/TXX.md` using `planning/task-reports/TEMPLATE.md`, then update the status tracker and CSV.
- Do not mark a task done until its required checks pass and its report exists. Record missing credentials, unavailable infrastructure and unverified live behavior as specific blockers; continue independent work where possible.
- On resumption, inspect the latest report and actual code state. Preserve user changes and do not repeat already verified work unnecessarily.
- Keep source data private, APIs stateless, long-running work durable, and evidence/revisions traceable. Apply the explicit access, recovery, scalability and deployment gates in the execution plan.
- Never claim mocked provider behavior is a live integration, a container build is a deployment, or an unmeasured scaling target is achieved capacity.
