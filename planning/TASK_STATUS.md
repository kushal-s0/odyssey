# Codex task status

**Application state:** T01 implementation in progress; no application/model deployed.  
**Budget:** zero paid API or hosting dependencies.  
**Active task:** T01. **Current scope:** implement T01 only.  
**Last update:** 2026-10-17, Asia/Calcutta. **Progress:** 0 / 28 tasks done.

Read [execution instructions](CODEX_EXECUTION_PLAN.md), [free model hosting](FREE_MODEL_HOSTING_PLAN.md) and [ordered tasks](IMPLEMENTATION_TASKS.md). States: `pending`, `in_progress`, `blocked`, `done`. A completed task needs actual checks and a report.

## Tracker

| ID | Task | Status | Report path (create during execution) | Blocker |
|---|---|---|---|---|
| T01 | Inspect dataset and prove free-runtime feasibility | in_progress | `task-reports/T01.md` | None confirmed |
| T02 | Scaffold application and local toolchain | pending | `task-reports/T02.md` | None confirmed |
| T03 | Define contracts, domain rules and rubric | pending | `task-reports/T03.md` | None confirmed |
| T04 | Implement database, durable stage leases and private storage | pending | `task-reports/T04.md` | None confirmed |
| T05 | Implement authentication and authorization | pending | `task-reports/T05.md` | None confirmed |
| T06 | Implement uploads and submission APIs | pending | `task-reports/T06.md` | None confirmed |
| T07 | Implement durable Postgres jobs and free-runtime dispatch | pending | `task-reports/T07.md` | None confirmed |
| T08 | Build applicant submission and recording UI | pending | `task-reports/T08.md` | None confirmed |
| T09 | Implement self-hosted extraction and Indic translation | pending | `task-reports/T09.md` | None confirmed |
| T09A | Train and evaluate our answer-relevance model | pending | `task-reports/T09A.md` | None confirmed |
| T10 | Implement PDF and handwritten scans with open weights | pending | `task-reports/T10.md` | None confirmed |
| T11 | Implement self-hosted regional audio transcription | pending | `task-reports/T11.md` | None confirmed |
| T12 | Implement evidence-backed ratings and deterministic totals | pending | `task-reports/T12.md` | None confirmed |
| T13 | Build assessor workspace, evidence viewer and review | pending | `task-reports/T13.md` | None confirmed |
| T14 | Implement authorized similar-idea retrieval | pending | `task-reports/T14.md` | None confirmed |
| T15 | Implement free OpenStreetMap business context | pending | `task-reports/T15.md` | None confirmed |
| T16 | Implement all four comparison views | pending | `task-reports/T16.md` | None confirmed |
| T17 | Implement clarification and reassessment | pending | `task-reports/T17.md` | None confirmed |
| T18 | Implement business arithmetic checks | pending | `task-reports/T18.md` | None confirmed |
| T19 | Implement reports and version history | pending | `task-reports/T19.md` | None confirmed |
| T20 | Evaluate dataset and our model with real measurements | pending | `task-reports/T20.md` | None confirmed |
| T21 | Harden access, uploads and failure boundaries | pending | `task-reports/T21.md` | None confirmed |
| T22 | Measure portable API and model scalability | pending | `task-reports/T22.md` | None confirmed |
| T23 | Package zero-spend application deployment | pending | `task-reports/T23.md` | None confirmed |
| T23A | Package and deploy versioned model runtimes | pending | `task-reports/T23A.md` | None confirmed |
| T24 | Deploy and verify the full free hosted application | pending | `task-reports/T24.md` | None confirmed |
| T25 | Run deployed acceptance and recovery checks | pending | `task-reports/T25.md` | None confirmed |
| T26 | Write final implementation and readiness handover | pending | `task-reports/T26.md` | None confirmed |

## Prerequisite record

The user confirmed an eligible Hugging Face account for free ZeroGPU. Actual Space provisioning, programmatic enqueue/auth behavior, available quotas and gated model downloads remain unverified. Language-review support and model quality also need validation. No paid alternative is authorized.

## Resume note

The user requested implementation of T01 only. Finish independent dataset/feasibility work and record actual live-access blockers; do not start T02 in this turn. Existing prepaid/paid-provider assumptions are superseded by FREE_MODEL_HOSTING_PLAN.md. Inspect actual code and the latest task report on resumption.

## History

- 2026-10-17: Created sequential Codex tasks and mandatory Markdown completion reports.
- 2026-10-17: Revised to free infrastructure and self-hosted open weights; added T09A custom relevance-model experiment and T23A model deployment. All 28 tasks remain pending.
