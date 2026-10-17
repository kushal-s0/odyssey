# TXX — Task title

## Status

- State: `in_progress | blocked | done`
- Updated: YYYY-MM-DD HH:MM Asia/Calcutta
- Task specification: `planning/IMPLEMENTATION_TASKS.md`, TXX
- Input prerequisites and report references:
- Revision/commit if available: use an actual identifier, or state “uncommitted”; do not invent one.

## Outcome

Describe the observable behavior now available. State whether it was checked locally, with fixtures, against a live provider, or in the deployed environment.

## Implemented changes

| File/path | Change and purpose |
|---|---|
| Actual path | Concrete change |

## Acceptance checks

| Required criterion | Result: PASS / FAIL / NOT RUN | Evidence |
|---|---|---|
| Copy the actual criterion | Actual result | Command, artifact or concise reproducible observation |

## Verification commands and results

| Exact command or manual procedure | Environment | Exit/result | Relevant output or artifact |
|---|---|---|---|
| Actual command | Local / fixture / live provider / deployed | Actual result | Safe summary; no secrets or personal data |

Record failures and repairs. List checks not run and their reason. Do not substitute a build success for a provider integration or browser-flow check.

## Configuration, migrations and operations

- Added/changed environment variable names and purpose; never include secret values.
- Schema migrations, indexes and compatibility considerations.
- Background-job, API or provider contract changes.
- New commands/dependencies and relevant runtime limits.
- Rollback or recovery implications, if any.

## Model and free-runtime evidence (when relevant)

- Base-model/artifact revision, tokenizer/preprocessing version, license and checksum.
- Actual runtime/plan, model cold/warm timing, RAM/VRAM, quota use and queue wait.
- For training: label provenance, group split, seed, baseline comparison and promotion/rejection decision.
- For deployment: owned runtime IDs, no-paid-fallback verification and sleep/quota recovery evidence.
- Mark not applicable for tasks that do not touch these areas; do not invent measurements.

## Limitations and blockers

State any incomplete acceptance criteria, unverified languages, missing credentials, unavailable infrastructure, performance shortfalls or open defects. Use “None identified by the checks above” only when supported. An unmet required criterion prevents `done`.

## Continuation

- Next eligible task:
- What the next task can rely on:
- Pending blocker to revisit:
- Tracker and CSV updated: yes/no

## Follow-up verification history

Append dated repair/recheck notes if this report is updated later. Retain prior material failures and explain their resolution.
