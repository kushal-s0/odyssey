# Implementation tasks

Updated: 17 October 2026. `[x]` implementation complete, `[-]` in progress, `[ ]` pending. Live account verification is tracked separately from implemented code.

## Foundation
- [x] Scaffold the React/TypeScript and Express/TypeScript workspaces.
- [x] Add configuration validation, Atlas connection, persistent models, and GridFS storage.
- [x] Add assessor authentication, protected records, and upload validation.
- [x] Build the professional black/white application shell and responsive navigation.

## Submission and assessment
- [x] Implement text/PDF/audio submission and browser recording.
- [x] Add durable processing jobs, retry states, and progress updates.
- [x] Implement hosted document extraction, transcription, translation, and embedding adapters.
- [x] Validate evidence references, numbers, missing fields, and contradictions.
- [x] Implement deterministic seven-dimension assessment and evidence coverage.
- [x] Build inbox, dashboard, original-source viewer, and assessment detail.
- [x] Implement Evidence Repair Loop, correction history, original clarification retention, and assessor review.

## Context and reporting
- [x] Implement similar-idea retrieval with duplicate/reviewed-family exclusions and keyword fallback.
- [x] Add confirmed-location lookup and sourced local business listings.
- [x] Build domain/trade/cohort comparisons with explicit unknown membership.
- [x] Add CSV and printable report export.

## Cloud model training
- [x] Prepare dataset inventory/import and reviewed annotation workflow. All 55 source files extracted; import dry run passed.
- [x] Create cloud notebook for grouped classifier training and evaluation.
- [x] Build a separate remote inference service with model compatibility checks and real-metric display.
- [ ] Execute cloud training and save measured results. Requires cloud session and labelled data.
- [ ] Connect and verify deployed inference. Requires hosted endpoint.

## Delivery
- [x] Add clearly labelled read-only examples for credential-free interface review.
- [x] Verify scoring, evidence rejection, provider failure states, source access guards, origin checks, and read-only API behavior.
- [x] Run TypeScript checks, 22 automated tests, production build, and four desktop/mobile browser tests.
- [x] Validate supplied formats: 42/42 PDFs opened (109 pages), 13/13 recordings decoded. Speech contents and translations are not yet verified.
- [x] Document local setup, API keys, Atlas, training, and deployment; create ignored `.env` with generated local secrets.
- [ ] Verify live Atlas and AI integrations. Requires service credentials.
- [ ] Deploy and run presentation checks. Requires deployment access.

## Next external steps

1. Set `MONGODB_URI`, `GEMINI_API_KEY`, and `SARVAM_API_KEY` in the root `.env`. Do not paste credentials into chat.
2. Restart with `npm.cmd run dev`, sign in using the credentials in `.env`, and process one real sample of each format/language before bulk import.
3. Review and label answers; run `training/cloud_training.ipynb` in a hosted Colab session; inspect the actual metrics.
4. Deploy the exported model to a remote host, configure `MODEL_SERVICE_URL`, and run parity checks.
5. Deploy the application and verify the live demo.

Local UI screenshots: `.planning/screenshots/overview-desktop.png` and `.planning/screenshots/overview-mobile.png`. Live credentials were not present during implementation; no training, public deployment, or live provider results are claimed.
