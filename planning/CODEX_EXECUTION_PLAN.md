# Codex execution instructions

**Project:** Udyam Saathi — Tata STRIVE business-idea screening.  
**Executor:** Codex. This replaces the earlier assignment of tasks to three human builders.  
**Current state:** planning review/revision only; no application task has passed its acceptance checks. See the tracker and actual code rather than inferring implementation from planning tools.

**Confirmed delivery deadline:** 18 October 2026, 06:00 Asia/Calcutta, including a deployed demo. Read [deadline checkpoints](HACKATHON_DELIVERY_PLAN.md) and [session handoff](SESSION_HANDOFF.md) first. These planning instructions do not authorize implementation or publication by themselves.

**Budget policy:** no paid API or hosting purchases, no trial-credit dependency and no paid fallback. The user confirmed an eligible free Hugging Face account; still verify real provisioning and quotas. Existing open weights are self-hosted; only the small answer-relevance model is trained for this project.

## 1. Start or resume

Read these files in this order:

1. [SESSION_HANDOFF.md](SESSION_HANDOFF.md), [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md) and [TASK_STATUS.md](TASK_STATUS.md) — authorized scope, confirmed decisions, deadline, current progress and blockers.
2. The latest report in `planning/task-reports/`, if one exists.
3. [IMPLEMENTATION_TASKS.md](IMPLEMENTATION_TASKS.md) — ordered task instructions and acceptance checks.
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — product requirements, data model, API contracts, scoring and dataset findings.
5. [FREE_MODEL_HOSTING_PLAN.md](FREE_MODEL_HOSTING_PLAN.md) - zero-spend stack, custom-model experiment and model deployment requirements.
6. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) — release requirements.

Inspect the real repository state before trusting a report. Preserve existing user changes and source datasets. Start with T01 when the user requests implementation. Do not execute implementation merely because this planning document exists.

Once implementation is requested, use the explicit order in HACKATHON_DELIVERY_PLAN.md: the text/model/scoring tasks precede T08 so its UI milestone can demonstrate actual assessment. Do not ask the user to manually start every task or approve routine reversible changes. Follow the user's requested scope: if they request one specific task, finish and report that task without expanding into the whole backlog. Ask before material uncertain choices, scope changes or unauthorized external publication; routine choices already settled in the handoff do not need reconfirmation.

The historical 30-hour event window is not time remaining. Recheck the clock against the fixed 18 October 06:00 IST deadline, use the delivery checkpoints, and reserve the last two hours for release fixes/rehearsal. Completion is not guaranteed. Prioritize functional end-to-end behavior and verification; record incomplete work honestly if time or external dependencies run out. Do not quietly remove required features to make the tracker appear complete.

## 2. Required task execution loop

For each task:

1. **Inspect:** read the task, its dependencies, relevant code, contracts and previous reports. Confirm prerequisites are actually usable.
2. **Record:** set its tracker state to `in_progress`; record the active task and concise intended outcome. Keep no more than one task active in a single execution stream.
3. **Implement:** finish the frontend/backend/storage/configuration needed for that task's observable behavior. A placeholder endpoint or static mock does not complete a real integration.
4. **Verify:** run the task's meaningful acceptance checks and relevant existing regression checks. Inspect failures and fix them. Record exact commands, exit results and the environment tested. Use existing focused checks where possible rather than creating tests that repeat implementation details.
5. **Document:** create `planning/task-reports/TXX.md` using [the report template](task-reports/TEMPLATE.md). Report what changed, relevant files, checks actually run, migrations/configuration, limitations and the next task.
6. **Update:** update `TASK_STATUS.md` and the matching row in `implementation-tasks.csv` with status and report path. A report must exist before a task becomes `done`.
7. **Continue:** move to the next eligible task without asking for routine confirmation. Share concise progress updates as work proceeds. If the conversation ends or context resets, the report and tracker are the continuation record.
8. **Checkpoint:** update SESSION_HANDOFF.md with exact next action, last verified command/result, partial work, active processes and pending decisions. Make a coherent local commit as Kartik when authorized; verify author and committer. No co-authors/sign-offs/AI trailers, pushes or remote publication. A new session must be able to resume without this chat.

No task is complete until its acceptance checks pass and its report is written. Do not pre-fill reports with predicted success. Preserve the checks/history when updating a report after a repair; do not erase earlier failure evidence.

## 3. Task states and external blockers

| State | Meaning |
|---|---|
| `pending` | Work has not started |
| `in_progress` | Currently implementing or verifying |
| `blocked` | A named missing dependency prevents required work or verification |
| `done` | Required implementation and checks passed, report exists, tracker updated |

These are project tracker states, independent of any system-level goal tooling.

If model-repository access, free quota, an account, language reviewer, deployment target or permission is missing:

- Complete the safe, independent parts first: adapter code, schema handling, fixtures, error states, local build and infrastructure manifests where applicable.
- Write a partial `TXX.md` report stating exactly what works, what was tested with fixtures, and which live check cannot run. Mark that task `blocked`, not `done`.
- Ask only for the missing prerequisite when necessary. Never request secrets in committed files or expose their values in chat/logs; point to the configured secret environment.
- Continue tasks whose explicit dependencies and required behavior can still be satisfied. Record any out-of-order work in the tracker. Do not bypass an unmet dependency silently.
- Apply the explicit independent-work allowance in HACKATHON_DELIVERY_PLAN.md: local T02 scaffolding may use verified dataset constraints while HF account checks remain blocked. Report unfinished capabilities; do not treat this as completed T01 or permission to claim a live model integration.
- Return to the blocked task when the prerequisite arrives. A mock/provider stub is test infrastructure and cannot count as live provider validation.

Do not mark T24 complete without a verified HTTPS deployment. T23 can establish deployability locally; T24 establishes an actual deployment. If only deployment access is missing, finish packaging/documentation and identify that precise gap without claiming the application is live.

## 4. Application-wide implementation rules

- Build the preferred judging profile after feasibility: React/TypeScript on Cloudflare Pages, lightweight FastAPI on Render Free, Supabase Free persistence and an authenticated owned-laptop inference worker using durable Postgres stage leases. Keep the two owned Gradio ZeroGPU runtimes as a separately verified deployment target. No hosted Redis or paid background worker. Follow FREE_MODEL_HOSTING_PLAN.md for both runtime contracts. Never call a laptop-backed deployment fully cloud hosted.
- Keep APIs stateless. Store files in object storage and job/result state in Postgres. Use bounded temporary files only for processing and clean them in failure paths.
- Run OCR, speech processing, AI calls and report generation in durable background jobs where they can exceed short request handling. Do not use in-process fire-and-forget jobs as the persistence mechanism.
- Treat queue delivery as at-least-once. Use revision/pipeline/stage keys, database uniqueness, durable checkpoints, worker leases, bounded retries and stale-job reconciliation. At most one result version may be published for a given key.
- Fence stale workers using an incrementing claim generation on every heartbeat/checkpoint/publication; lease expiry alone is insufficient. Obtain fresh signed source URLs after claim and define capability renewal for queue delays. Authenticate before GPU allocation in a non-exposed wrapper; never expose a bypass inference endpoint.
- Inference can be repeated after a crash even when result publication is idempotent. Checkpoint work, cap retries and account for shared GPU quota. Never introduce a paid fallback or quota bypass.
- Validate authorization at every resource boundary, including job polling, uploaded attachments, evidence, reports, similarity and aggregates. Use trusted role assignment and scoped data access.
- Keep source evidence and English translations together. Unknown facts remain null. Never use language, name or social category to infer business quality. Preserve ambiguity in overwritten answers.
- Use typed, versioned contracts. Keep one source of truth for API models and generated frontend types. Record breaking changes before altering dependent clients.
- Keep credentials server-side; public frontend configuration contains only public identifiers. Separate development and deployment data.
- Control load: file/page/duration limits, per-user jobs, request rate limits, queue admission, worker concurrency, connection pools and shared free-runtime quota reservations. Limits must be shared across API instances.
- Log request/job IDs, stage timings, safe errors and measured usage. Avoid logging source personal data. Distinguish partial completion from total failure.
- Implement the full brief: all three input formats, six dataset languages subject to measured validation, reasoned domain ratings, similar ideas, location context and all four comparison views. English/Hindi human review are available; Marathi/Telugu/Bengali/Odia remain unvalidated. Explicitly implement language identification, with a declared-language fallback labeled accurately. Do not rely on script detection to distinguish Hindi from Marathi.
- Preserve evidence-backed additional technical facts when questions differ from the standard form. Detect script/glyph corruption beyond null/replacement characters; a nonempty text layer is not proof of reliable regional extraction.
- Use precreated trusted demo accounts rather than public email signup. Verify the actual Supabase JWT configuration and database connection mode; use a shared session pooler for IPv4-only connectivity rather than buying an add-on. Public Nominatim remains opt-in under its policy; use confirmed coarse location and licensed snapshots until Kartik opts in.
- Include the clarification loop and arithmetic checker as explicit tasks. Read-aloud, collaboration matching and a full map remain future scope.

## 5. Scalability must have evidence

T22 must demonstrate stateless API replication and independent worker scaling on local/owned test infrastructure. Do not run load tests against public free services. Use this **initial verification workload**, recording the hardware/container limits, dataset shape and measured results:

| Area | Workload and gate |
|---|---|
| List/filter/analytics queries | 10,000 synthetic metadata records, indexes and bounded pagination; inspect query plans and record p50/p95 latency |
| API replication | Two API instances behind a local proxy; submit/poll across both without sticky sessions or missing state |
| Worker concurrency | Two workers, 20 queued jobs, duplicate delivery and a worker termination; no lost accepted jobs or duplicate published versions |
| Concurrent requests | 50 virtual users for metadata/status traffic for 5 minutes; target p95 below 500 ms and unexpected errors below 1% in the documented test environment |
| Runtime pressure | Inject GPU quota exhaustion, Space sleep, OOM and timeouts; verify bounded retry, queue backpressure, preserved checkpoints and shared quota enforcement |

Provider-free load tests measure application infrastructure only. Record real AI latency separately on representative samples. No claim of thousands of simultaneous AI submissions follows from a metadata test. Begin with exact vector search for the small corpus; introduce an approximate index only when the larger benchmark/query plan justifies it and retrieval quality remains acceptable.

T23 must deliver reproducible application builds, migrations, service configuration, health checks, CI, rollback and operating instructions. T23A must deliver model manifests, classifier/baseline artifacts, two free Space deployments and cold/warm memory/latency measurements. T09A performs the small relevance-model training experiment with an explicit promotion/rejection decision. T24 and T25 must validate the live environment. The final readiness report distinguishes verified results, targets not reached and work that remains blocked.

T01 proves the model/runtime path early and T02 prepares deployable skeleton configuration. Seek explicit approval for an early sanitized preview; do not wait for final packaging to discover hosting incompatibility. This does not mark T23/T24 done or waive any final gate. T23A also packages and measures the preferred laptop worker; HF blockers remain separate and visible. Distinguish a verified selected-profile demo from full completion of all 28 tasks.

## 6. Completion and handover

The implementation is complete when all 28 tasks (T01-T26 plus T09A and T23A) are `done`, every report exists, the deployed end-to-end checks pass, and the deployment checklist is supported by recorded evidence. If any of these remain unmet, provide a precise partial-completion report instead of calling the application production-ready.

At handover, distinguish quota-limited free deployment from capacity on additional owned hardware. Provide the deployed URL, release/version identifier, startup/deployment instructions, actual test results, dataset evaluation, scaling measurements, cost/configuration notes and any residual limitations. The app is a first-line assessment aid; final program/funding decisions remain with authorized reviewers.

## 7. Prompt to start implementation

```text
Implement this application by following planning/CODEX_EXECUTION_PLAN.md.
Read planning/TASK_STATUS.md, planning/IMPLEMENTATION_TASKS.md and
planning/IMPLEMENTATION_PLAN.md and planning/FREE_MODEL_HOSTING_PLAN.md
before editing application code. Use no paid APIs or purchased hosting.

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
