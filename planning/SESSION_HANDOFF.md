# Session handoff

Updated 17 October 2026, 23:25 IST. Deadline: 18 October 06:00 IST including deployed demo. Read AGENTS.md and HACKATHON_RESET.md before continuing.

## Current authorization and identity

- Branch `second`, origin `https://github.com/kushal-s0/odyssey.git`. New author AND committer: Kartik Verma <kartikverma2204number1@gmail.com>. No attribution trailers, no historical rewrites. Local commits only; no push/PR/public deployment/source upload approval.
- User's immediate priority: make the existing signed-in app actually work. Supabase login ONLY; no demo bypass or database rewrite. Keep React/FastAPI/Supabase and the owned RTX5050 laptop worker. No paid APIs, trial-credit dependency or extra production infrastructure.
- User permits inspecting private environment files. Never print credentials. They selected an existing account for applicant access and separately approved a disposable live-verification account with scoped cleanup.
- English/Hindi human review only; other languages remain unvalidated. Keep external license/provenance records accurate.

## Actual startup failure and repair

The old API cached a failed initial database connection. The corrected root DATABASE_URL now connects through the actual Supabase shared session pooler; network/TLS succeeds. The hosted Auth project had five accounts but zero application profiles/cohorts. Password login alone therefore could not open the workspace.

All five migrations were applied with checksum tracking to the configured Supabase project. The selected existing account now has only applicant access and a Hackathon demo cohort; password unchanged. Private originals bucket retained. Root settings are filled; do not ask for the same keys again.

Launcher now checks actual database-backed `/health/workspace` before starting the usable app, instead of printing success immediately. Frontend shows database availability, signed-in loading/error states and Retry workspace connection. Static landing no longer hides signed-in failures. Assessor tools remain explicitly unfinished. Upload success distinguishes originals from written ideas; queue copy explains concurrency one and multi-minute model processing.

## Verification this repair

- Real Supabase password login, actual ES256 API session verification, trusted profile/cohort, workspace retry, real GPU English assessment/source evidence, reload persistence: PASS in Edge.
- Actual hosted private PDF upload and byte-identical authenticated download: PASS. Complete digital-PDF assessment/display/sign-out and scoped remote cleanup also PASSED in the PDF-only retry; see `evals/reports/live-app.json`. The first combined test hit its queue wait bound; retained honestly in `live-app-first-attempt.json`.
- Full backend suite: 144 passed/no skips, 86.16s. Ruff passed; strict mypy passed on 55 files. Frontend typecheck/lint/build and desktop/mobile Edge smoke passed, no page errors/overflow.
- Configured private secrets absent from changed source and built browser assets. Logs/artifacts stay ignored under .local/.
- The live test's initial workspace 503 is deliberately injected to test retry. Its Auth, successful API/persistence/storage/model calls are real; older browser fixtures remain separately labeled.

## Preserved PDF/model checkpoint

- Digital PDF handler and page evidence now connected; real local two-page PDF assessment passed in70.453s with intact original and three grounded fields. Page checkpoints/recovery and OCR uncertainty gating are implemented.
- Full 11-page Hindi scan quality FAILED with Qwen (first page hit1024-token cap in219.342s). Interrupted/restarted after saved page1 at lease generation2; no full scan completion claimed. T10 blocked; see its new report and evals/reports/pdf-pipeline.json.
- Transformers5.0.0/huggingface-hub1.33.0 now installed in .venv-model; real English pipeline passed with this runtime. Torch2.9.1+cu128, NumPy2.2.6 retained. Qwen/MiniLM cached. Do not redownload/reinstall working weights unnecessarily.
- Native PaddleOCR-VL-1.5 adapter and pinned manifest candidate prepared, NOT integrated or inference-tested; download was incomplete. Do not mistake its presence for working OCR. .cache remains private/ignored.
- AI4Bharat gated translation/ASR probes previously401. Public NLLB/Whisper alternatives only candidates, not integrated. T09A relevance experiment was run and rejected; frozen MiniLM/rules baseline remains selected. No new foundation-model training claim.

## Running services and verification safety

The user's app was restarted using corrected settings and intentionally left running on127.0.0.1:5173 and8000 with a continuous owned worker (launcher exec26861). Inspect actual process ownership before stopping/restarting. Ctrl+C on its launcher stops only its children. Logs .local/run-logs. Existing user submissions were retained; do not cancel/delete them.

Disposable live verification (`scripts/verify_live_app.py`; first exec16826, PDF-only retry exec76393) has finished. Both temporary accounts/cohorts/objects/submissions were removed, existing user records retained. No verification worker/browser is retained; normal app remains running. Private synthetic screenshots/results remain ignored under .local/live-app-*/. Explicit authorization covered these scoped live tests. Ordinary pytest fixtures NEVER target hosted data.

Optional local test Postgres is already on127.0.0.1:55432 with ignored .local/test-database-url. Do not start/delete another DB/volume. Run local DB suites and model/browser harnesses sequentially; they share admission/claims. Real hosted checks use their separate disposable records.

## Next work

Requested startup/access repair and live PDF check/cleanup are complete. Reports/status/CSV updated; commit locally as Kartik. Keep T04/T05/T06 blocked where the full hosted matrix/quota/recovery gates remain unverified; do not equate partial engineering gates with no working product.

Then follow the user priority and HACKATHON_RESET.md: reliable handwritten OCR, audio/translation, assessor workspace, similar submissions, sourced local business context and four comparison views. Reuse working stages/contracts, keep README short, maintain explanations/, and finish with T27 detailed free deployment instructions. Publication still requires separate explicit approval. Do not train unrelated internet data into fake screening labels or spend time on secondary HF/scale work before the brief.

PowerShell uses npm.cmd. Normal startup .\start.cmd; setup .\setup.cmd. Optional preview does not bypass Auth or run inference. Root .env.local is the one local config; .venv and .venv-model are dependency environments, not additional services.

Final UI follow-up: status refresh is disabled while a status request is in flight, preventing repeated clicks from aborting retrieval. A terminal processing state refreshes the saved list so it does not remain labeled queued after an assessment completes.
