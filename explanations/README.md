# Implementation and committee preparation

This directory explains the implementation as it is built. It is a companion to actual code, task reports and measured results, not a claim that planned features exist.

| Guide | Purpose |
|---|---|
| [00-startup-and-model-results.md](00-startup-and-model-results.md) | One local config, simple startup and measured real inference |
| [STARTUP_AND_ACCESS.md](STARTUP_AND_ACCESS.md) | Actual login/startup failure, repair, and live verification boundaries |
| [01-dataset-and-feasibility.md](01-dataset-and-feasibility.md) | Inventory, evidence privacy, model feasibility and limitations |
| [02-application-foundation.md](02-application-foundation.md) | App structure, configuration, health, frontend and verification |
| [03-contracts-and-rubric.md](03-contracts-and-rubric.md) | Typed evidence, nulls, provenance, scoring and comparison eligibility |
| [04-data-and-jobs.md](04-data-and-jobs.md) | RLS/private files, durable claims, fencing and local recovery evidence |
| [05-authentication-and-access.md](05-authentication-and-access.md) | Signed sessions, trusted roles/cohorts, login and judging-account setup |
| [06-uploads-and-submissions.md](06-uploads-and-submissions.md) | Private file validation, intact originals, retries, atomic job intent and cleanup |
| [07-worker-checkpoint.md](07-worker-checkpoint.md) | Partial durable worker service and exact unfinished boundaries |
| [08-applicant-workspace.md](08-applicant-workspace.md) | Verified local applicant UI checkpoint and remaining review |
| [09-text-pipeline.md](09-text-pipeline.md) | Actual owned text stages, exact quotes, model gates and limits |
| [09a-relevance.md](09a-relevance.md) | Reproducible experimental classifier and rejection decision |
| [12-assessments.md](12-assessments.md) | Grounded domain judgments, atomic persistence and server totals |
| [COMMITTEE_QUESTIONS.md](COMMITTEE_QUESTIONS.md) | Likely judging questions and evidence-backed answers |

Each implemented module gets an explanation of its purpose, main files/functions, input/output, data flow, security boundaries, failure handling, verification and tradeoffs. Add a link here when a guide exists. The final T27 adds `docs/DEPLOYMENT_GUIDE.md` and deployment Q&A after the actual configuration is known.

External models, libraries and permitted public data may be used. Their licenses/provenance belong in the model manifests and source records; required attribution is retained. Our own code, our trained candidate and pretrained models are described accurately.
