# Start here: implementation plan for Codex

> **Latest user direction (17 October 2026):** prioritize a working hackathon solution, not production completion gates. Read [HACKATHON_RESET.md](HACKATHON_RESET.md) first. Its demo order supersedes the older mandatory sequential release/deployment gates below; preserve unfinished work honestly. Supabase is the single application database; local PG/Docker are optional tests. Secondary HF deployment and large scale experiments are deferred.

This is a complete task-by-task execution plan for **Codex** to build Udyam Saathi, a scalable and deployable Tata STRIVE business-idea screening application. It replaces the earlier human team assignment plan.

**Current state: implementation underway; consult TASK_STATUS.md and task reports.** No cloud deployment is verified. Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md) first when changing models/sessions/accounts; the current user request authorizes full implementation and ongoing explanations/ documentation.

**Deadline: 18 October 2026, 06:00 Asia/Calcutta, deployed demo included.** Follow [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md) for the explicit task order, early deployment checkpoints and distinction between demo verification and full-backlog completion. See [PROJECT_REVIEW.md](PROJECT_REVIEW.md) for findings and unverified assumptions.

**Budget requirement:** no paid APIs or purchased hosting. Prefer verified owned-laptop inference for judging to avoid expiring provider inference allowances; use Render Free API, Cloudflare Pages Free and Supabase Free. Keep eligible-account Gradio ZeroGPU runtimes as a separate quota-limited deployment target. See [free deployment and model plan](FREE_MODEL_HOSTING_PLAN.md). T09A trains a small relevance model; T23A packages/deploys the versioned local and hosted runtimes. English/Hindi review are available; other corpus languages remain unvalidated. Commit locally only as Kartik, without trailers; no publication without explicit approval.

## Files Codex must follow

1. [CODEX_EXECUTION_PLAN.md](CODEX_EXECUTION_PLAN.md): execution loop, continuation rules, blockers, scalability requirements and the full start prompt.
2. [IMPLEMENTATION_TASKS.md](IMPLEMENTATION_TASKS.md): T01-T26 plus T09A/T23A in execution order, dependencies, target files, implementation instructions and acceptance checks.
3. [TASK_STATUS.md](TASK_STATUS.md): progress tracker and resume point.
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): product scope, architecture, APIs, data model and scoring behavior.
5. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md): actual release verification.
6. [Report template](task-reports/TEMPLATE.md): mandatory completion report format.
7. [Task CSV](implementation-tasks.csv): the same task/status inventory for import or inspection.

## What happens after every task

```text
Read task and dependencies
        |
Implement the complete task
        |
Run required checks and fix failures
        |
Write planning/task-reports/TXX.md with actual evidence
        |
Update TASK_STATUS.md and implementation-tasks.csv
        |
Continue to the next eligible task
```

If a prerequisite blocks required verification, Codex records a partial report and marks the task blocked. It can continue independent work, but cannot mark a mocked integration or missing deployment as done.

## Give Codex this instruction when ready to build

```text
Follow planning/CODEX_EXECUTION_PLAN.md and implement the full backlog
in planning/IMPLEMENTATION_TASKS.md. Start from the first eligible
incomplete task in planning/TASK_STATUS.md.

After each task, run its checks, write planning/task-reports/TXX.md using
the template, update the tracker and CSV, and continue without asking
for routine confirmation. Preserve original uploads and user changes. Follow
planning/FREE_MODEL_HOSTING_PLAN.md; do not add paid APIs or hosting. Complete
T09A model training/evaluation and T23A model deployment as specified.

Implement the durable-worker, access-control, scalability and deployment
requirements. Record external blockers honestly and continue independent
work. Do not claim deployment or live validation without real evidence.
```

Task reports are intentionally not pre-created. Codex writes them as it implements the application. Only the reusable template exists now.
