# Implementation and committee preparation

This directory explains the implementation as it is built. It is a companion to actual code, task reports and measured results, not a claim that planned features exist.

| Guide | Purpose |
|---|---|
| [01-dataset-and-feasibility.md](01-dataset-and-feasibility.md) | Inventory, evidence privacy, model feasibility and limitations |
| [02-application-foundation.md](02-application-foundation.md) | App structure, configuration, health, frontend and verification |
| [03-contracts-and-rubric.md](03-contracts-and-rubric.md) | Typed evidence, nulls, provenance, scoring and comparison eligibility |
| [04-data-and-jobs.md](04-data-and-jobs.md) | RLS/private files, durable claims, fencing and local recovery evidence |
| [05-authentication-and-access.md](05-authentication-and-access.md) | Signed sessions, trusted roles/cohorts, login and judging-account setup |
| [COMMITTEE_QUESTIONS.md](COMMITTEE_QUESTIONS.md) | Likely judging questions and evidence-backed answers |

Each implemented module gets an explanation of its purpose, main files/functions, input/output, data flow, security boundaries, failure handling, verification and tradeoffs. Add a link here when a guide exists. The final T27 adds `docs/DEPLOYMENT_GUIDE.md` and deployment Q&A after the actual configuration is known.

External models, libraries and permitted public data may be used. Their licenses/provenance belong in the model manifests and source records; required attribution is retained. Our own code, our trained candidate and pretrained models are described accurately.
