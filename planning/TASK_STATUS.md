# Codex task status

> **Current demo priorities:** [HACKATHON_RESET.md](HACKATHON_RESET.md) supersedes the old release order. This table preserves the engineering backlog and its unverified gates; its done count is not product-completion percentage. Secondary HF/large scale work is deferred while brief features are implemented.


**Application state:** local app runs against actual Supabase; real English text and digital-PDF model assessments verified in a browser. No public application deployment.
**Budget:** zero paid API or hosting dependencies.  
**Active application task:** None; requested startup/access repair completed and verified. **Current scope:** full implementation, explanations/ and final T27 deployment walkthrough; local commits only.
**Last update:** 2026-10-17, Asia/Calcutta. **Progress:** 5 / 29 tasks done.

**Deadline:** 2026-10-18 06:00 Asia/Calcutta, working deployed demo included. Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md), [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md) and [PROJECT_REVIEW.md](PROJECT_REVIEW.md). Prefer verified laptop inference; English/Hindi human review only. Implementation is authorized by the latest user request; publication remains unapproved.

Read [execution instructions](CODEX_EXECUTION_PLAN.md), [free model hosting](FREE_MODEL_HOSTING_PLAN.md) and [ordered tasks](IMPLEMENTATION_TASKS.md). States: `pending`, `in_progress`, `blocked`, `done`. A completed task needs actual checks and a report.

## Tracker

| ID | Task | Status | Report path (create during execution) | Blocker |
|---|---|---|---|---|
| T01 | Inspect dataset and prove free-runtime feasibility | blocked | `task-reports/T01.md` | Gated language models/handwriting/audio and HF provisioning/access/quota unverified; owned English assessment and embeddings restored |
| T02 | Scaffold application and local toolchain | done | `task-reports/T02.md` | None confirmed |
| T03 | Define contracts, domain rules and rubric | done | `task-reports/T03.md` | None confirmed |
| T04 | Implement database, durable stage leases and private storage | blocked | `task-reports/T04.md` | Actual Supabase migrations/private-object operations pass; hosted Free-plan quota/account and recovery gates unverified |
| T05 | Implement authentication and authorization | blocked | `task-reports/T05.md` | Real Supabase login/ES256/reload/logout pass; full hosted cross-cohort access matrix and forced token refresh unverified |
| T06 | Implement uploads and submission APIs | blocked | `task-reports/T06.md` | Actual hosted private PDF upload/download/delete pass; hosted retry/recovery matrix incomplete |
| T07 | Implement durable Postgres jobs and free-runtime dispatch | blocked | `task-reports/T07.md` | Owned HTTP/native recovery verified; secondary HF provisioning/quota compatibility deferred and unverified |
| T08 | Build applicant submission and recording UI | done | `task-reports/T08.md` | None confirmed |
| T09 | Implement self-hosted extraction and Indic translation | blocked | `task-reports/T09.md` | English/adversarial owned assessments verified; IndicTrans2 401, longer exact-quote extraction, human review and remaining runtime gates pending |
| T09A | Train and evaluate our answer-relevance model | done | `task-reports/T09A.md` | None confirmed |
| T10 | Implement PDF and handwritten scans with open weights | blocked | `task-reports/T10.md` | Digital PDF passes; full Hindi handwriting quality failed; OCR replacement not integrated |
| T11 | Implement self-hosted regional audio transcription | pending | `task-reports/T11.md` | None confirmed |
| T12 | Implement evidence-backed ratings and deterministic totals | done | `task-reports/T12.md` | None confirmed |
| T13 | Build assessor workspace, evidence viewer and review | pending | `task-reports/T13.md` | None confirmed |
| T14 | Implement authorized similar-idea retrieval | pending | `task-reports/T14.md` | None confirmed |
| T15 | Implement free OpenStreetMap business context | pending | `task-reports/T15.md` | None confirmed |
| T16 | Implement all four comparison views | pending | `task-reports/T16.md` | None confirmed |
| T17 | Implement clarification and reassessment | pending | `task-reports/T17.md` | None confirmed |
| T18 | Implement business arithmetic checks | pending | `task-reports/T18.md` | None confirmed |
| T19 | Implement reports and version history | pending | `task-reports/T19.md` | None confirmed |
| T20 | Evaluate dataset and our model with real measurements | pending | `task-reports/T20.md` | Human review currently available only for English/Hindi; other language quality unvalidated |
| T21 | Harden access, uploads and failure boundaries | pending | `task-reports/T21.md` | None confirmed |
| T22 | Measure portable API and model scalability | pending | `task-reports/T22.md` | Docker verified locally at T04; required two-API/two-worker scale experiment not run |
| T23 | Package zero-spend application deployment | pending | `task-reports/T23.md` | None confirmed |
| T23A | Package and deploy versioned model runtimes | pending | `task-reports/T23A.md` | Required HF provisioning/model access unverified; publication approval absent |
| T24 | Deploy and verify the full free hosted application | pending | `task-reports/T24.md` | Service projects/access not verified; publication approval absent |
| T25 | Run deployed acceptance and recovery checks | pending | `task-reports/T25.md` | None confirmed |
| T26 | Write final implementation and readiness handover | pending | `task-reports/T26.md` | None confirmed |
| T27 | Write detailed free-deployment walkthrough | pending | `task-reports/T27.md` | Deployment configuration must be finalized and verified |

## Prerequisite record

The prior plan records an eligible Hugging Face account for free ZeroGPU. Actual Space provisioning, enqueue/auth behavior, quota attribution and gated model downloads remain unverified. Current preference is inference without expiring provider allowance, using the owned laptop if its smoke tests pass. GPU readout: RTX 5050 Laptop, 8151 MiB VRAM; system memory 24,841,998,336 bytes. Bounded CUDA/Qwen model fit has since been measured in T01; this does not verify the full pipeline. Docker was unavailable at review and was started/tested during T04. English/Hindi human review are available; Marathi/Telugu/Bengali/Odia are not yet human-validated. Cloud account/project access, selected Free plans and all publication approvals remain unverified/absent. No paid alternative is authorized.

## Resume note

User redirected work to the functional hackathon demo; read HACKATHON_RESET.md and SESSION_HANDOFF.md. Current branch second, current machine Kartik's RTX5050. New commits only as Kartik Verma <kartikverma2204number1@gmail.com>, confirmed in chat. Preserve historical attribution and original sources. Current model environment restored and actual English inference verified; uploaded files are not PDF/audio processing. Prioritize actual assessor, modality, translation, similarity/context and comparison requirements; no extra production infrastructure. Publication unapproved.

## History

- 2026-10-17: Created sequential Codex tasks and mandatory Markdown completion reports.
- 2026-10-17: Revised to free infrastructure and self-hosted open weights; added T09A custom relevance-model experiment and T23A model deployment. All 29 tasks remain pending.
- 2026-10-17: Reviewed original brief, dataset containers/PDFs, plans, official runtime limits and laptop hardware. Confirmed 18 October 06:00 IST deployed-demo deadline, preference for owned inference and English/Hindi review. Added deadline/continuation documents and reconciled stale T01 state; no application task marked complete.

- 2026-10-17: User authorized full implementation, external resources with retained license/provenance, ongoing explanations/ and final T27 deployment walkthrough. T01 started; actual branch main retained.

- 2026-10-17 22:22 IST: Cleanup/single local env/startup complete; setup and launcher preview/cleanup passed. Real RTX5050 English assessment and 10 applicant browser journeys passed; T08 done. Supabase service key missing and supplied database hostname does not resolve. No hosted changes/publication.

- 2026-10-17 23:25 IST: Real Supabase startup/access repaired and existing applicant account provisioned. English and digital-PDF GPU assessments passed through live browser/Auth/database/private storage; temporary test accounts/data cleaned up. 144 backend tests and frontend checks pass. Initial PDF test timeout retained as failure evidence; PDF-only retry passed.
