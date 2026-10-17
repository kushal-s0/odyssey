# Codex execution instructions

**Project:** Udyam Saathi — Tata STRIVE business-idea screening.  
**Executor:** Codex. This replaces the earlier assignment of tasks to three human builders.  
**Current state:** planning only; no application tasks have been executed.

## 1. Start or resume

Read these files in this order:

1. [TASK_STATUS.md](TASK_STATUS.md) — current progress, active task and blockers.
2. The latest report in `planning/task-reports/`, if one exists.
3. [IMPLEMENTATION_TASKS.md](IMPLEMENTATION_TASKS.md) — ordered task instructions and acceptance checks.
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — product requirements, data model, API contracts, scoring and dataset findings.
5. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) — release requirements.

Inspect the real repository state before trusting a report. Preserve existing user changes and source datasets. Start with T01 when the user requests implementation. Do not execute implementation merely because this planning document exists.

Once implementation is requested, implement tasks in ascending order by default. Do not ask the user to manually start every task or approve routine reversible changes. Follow the user's requested scope: if they request one specific task, finish and report that task without expanding into the whole backlog.

The 30-hour hackathon deadline remains a scope constraint, not a guarantee of completion. Prioritize functional end-to-end behavior and verification; record incomplete work honestly if time or external dependencies run out. Do not quietly remove required features to make the tracker appear complete.

## 2. Required task execution loop

For each task:

1. **Inspect:** read the task, its dependencies, relevant code, contracts and previous reports. Confirm prerequisites are actually usable.
2. **Record:** set its tracker state to `in_progress`; record the active task and concise intended outcome. Keep no more than one task active in a single execution stream.
3. **Implement:** finish the frontend/backend/storage/configuration needed for that task's observable behavior. A placeholder endpoint or static mock does not complete a real integration.
4. **Verify:** run the task's meaningful acceptance checks and relevant existing regression checks. Inspect failures and fix them. Record exact commands, exit results and the environment tested. Use existing focused checks where possible rather than creating tests that repeat implementation details.
5. **Document:** create `planning/task-reports/TXX.md` using [the report template](task-reports/TEMPLATE.md). Report what changed, relevant files, checks actually run, migrations/configuration, limitations and the next task.
6. **Update:** update `TASK_STATUS.md` and the matching row in `implementation-tasks.csv` with status and report path. A report must exist before a task becomes `done`.
7. **Continue:** move to the next eligible task without asking for routine confirmation. Share concise progress updates as work proceeds. If the conversation ends or context resets, the report and tracker are the continuation record.

No task is complete until its acceptance checks pass and its report is written. Do not pre-fill reports with predicted success. Preserve the checks/history when updating a report after a repair; do not erase earlier failure evidence.

## 3. Task states and external blockers

| State | Meaning |
|---|---|
| `pending` | Work has not started |
| `in_progress` | Currently implementing or verifying |
| `blocked` | A named missing dependency prevents required work or verification |
| `done` | Required implementation and checks passed, report exists, tracker updated |

These are project tracker states, independent of any system-level goal tooling.

If an API key, account, language reviewer, deployment target or permission is missing:

- Complete the safe, independent parts first: adapter code, schema handling, fixtures, error states, local build and infrastructure manifests where applicable.
- Write a partial `TXX.md` report stating exactly what works, what was tested with fixtures, and which live check cannot run. Mark that task `blocked`, not `done`.
- Ask only for the missing prerequisite when necessary. Never request secrets in committed files or expose their values in chat/logs; point to the configured secret environment.
- Continue tasks whose explicit dependencies and required behavior can still be satisfied. Record any out-of-order work in the tracker. Do not bypass an unmet dependency silently.
- Return to the blocked task when the prerequisite arrives. A mock/provider stub is test infrastructure and cannot count as live provider validation.

Do not mark T24 complete without a verified HTTPS deployment. T23 can establish deployability locally; T24 establishes an actual deployment. If only deployment access is missing, finish packaging/documentation and identify that precise gap without claiming the application is live.

## 4. Application-wide implementation rules

- Build a modular application: React/TypeScript frontend; FastAPI API; Celery workers; Redis-compatible broker; Postgres/pgvector; private object storage; provider adapters. Use the selected stack in the architecture document unless inspection establishes a concrete incompatibility.
- Keep APIs stateless. Store files in object storage and job/result state in Postgres. Use bounded temporary files only for processing and clean them in failure paths.
- Run OCR, speech processing, AI calls and report generation in durable background jobs where they can exceed short request handling. Do not use in-process fire-and-forget jobs as the persistence mechanism.
- Treat queue delivery as at-least-once. Use revision/pipeline/stage keys, database uniqueness, durable checkpoints, worker leases, bounded retries and stale-job reconciliation. At most one result version may be published for a given key.
- External calls are not automatically exactly-once: use provider idempotency where available, and record unavoidable retry/billing uncertainty after a crash. Do not promise zero duplicate provider charges without evidence.
- Validate authorization at every resource boundary, including job polling, uploaded attachments, evidence, reports, similarity and aggregates. Use trusted role assignment and scoped data access.
- Keep source evidence and English translations together. Unknown facts remain null. Never use language, name or social category to infer business quality. Preserve ambiguity in overwritten answers.
- Use typed, versioned contracts. Keep one source of truth for API models and generated frontend types. Record breaking changes before altering dependent clients.
- Keep credentials server-side; public frontend configuration contains only public identifiers. Separate development and deployment data.
- Control load: file/page/duration limits, per-user jobs, request rate limits, queue admission, worker concurrency, connection pools and provider budget reservations. Limits must be shared across API instances.
- Log request/job IDs, stage timings, safe errors and measured usage. Avoid logging source personal data. Distinguish partial completion from total failure.
- Implement the full brief: all three input formats, six dataset languages subject to measured validation, reasoned domain ratings, similar ideas, location context and all four comparison views.
- Include the clarification loop and arithmetic checker as explicit tasks. Read-aloud, collaboration matching and a full map remain future scope.

## 5. Scalability must have evidence

T22 must demonstrate stateless API replication and independent worker scaling. Use this **initial verification workload**, recording the hardware/container limits, dataset shape and measured results:

| Area | Workload and gate |
|---|---|
| List/filter/analytics queries | 10,000 synthetic metadata records, indexes and bounded pagination; inspect query plans and record p50/p95 latency |
| API replication | Two API instances behind a local proxy; submit/poll across both without sticky sessions or missing state |
| Worker concurrency | Two workers, 20 queued jobs, duplicate delivery and a worker termination; no lost accepted jobs or duplicate published versions |
| Concurrent requests | 50 virtual users for metadata/status traffic for 5 minutes; target p95 below 500 ms and unexpected errors below 1% in the documented test environment |
| Provider pressure | Inject rate limits/timeouts; verify bounded retry, queue backpressure and shared budget enforcement |

Provider-free load tests measure application infrastructure only. Record real AI latency separately on representative samples. No claim of thousands of simultaneous AI submissions follows from a metadata test. Begin with exact vector search for the small corpus; introduce an approximate index only when the larger benchmark/query plan justifies it and retrieval quality remains acceptable.

T23 must deliver reproducible container builds, migrations, service configuration, health checks, CI, rollback and operating instructions. T24 and T25 must validate the live environment. The final readiness report distinguishes verified results, targets not reached and work that remains blocked.

## 6. Completion and handover

The implementation is complete when T01–T26 are `done`, every report exists, the deployed end-to-end checks pass, and the deployment checklist is supported by recorded evidence. If any of these remain unmet, provide a precise partial-completion report instead of calling the application production-ready.

At handover, provide the deployed URL, release/version identifier, startup/deployment instructions, actual test results, dataset evaluation, scaling measurements, cost/configuration notes and any residual limitations. The app is a first-line assessment aid; final program/funding decisions remain with authorized reviewers.

## 7. Prompt to start implementation

```text
Implement this application by following planning/CODEX_EXECUTION_PLAN.md.
Read planning/TASK_STATUS.md, planning/IMPLEMENTATION_TASKS.md and
planning/IMPLEMENTATION_PLAN.md before editing application code.

Start at the first eligible incomplete task and work through the full
ordered backlog. For each task: implement its complete behavior, run
the required checks, write planning/task-reports/TXX.md using TEMPLATE.md,
then update TASK_STATUS.md and implementation-tasks.csv. Continue to the
next eligible task without asking for routine confirmation.

Keep the application stateless where appropriate, move slow work to
durable workers, enforce access boundaries, preserve evidence and nulls,
and implement the deployment and scalability verification tasks.
Do not call mock tests live validation or mark blocked work done.
If a prerequisite is missing, record it, request only what is necessary,
and continue independent work. Resume from the tracker and reports after
any interruption. The release is complete only after the live checks and
final readiness report pass.
```
