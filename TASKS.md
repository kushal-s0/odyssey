# Implementation tasks

Updated: 18 October 2026. `[x]` implementation complete, `[-]` in progress, `[ ]` pending. Live account verification is tracked separately from implemented code.

Current prioritized audit: [PROJECT_STATUS.md](PROJECT_STATUS.md). Older sections below retain historical test counts and connection/provider states; use the audit and latest verification entries for present status. In particular, current Atlas connectivity is healthy, nearby listings remain externally unreliable, the hosted classifier is not connected, and a successful full live clarification check remains unverified.

## Personal dashboards and external-data cloud training
- [x] Add public home, dedicated authentication, protected role dashboards and automatic progress updates.
- [x] Scope dashboard statistics in the database to each entrepreneur; verify cross-account isolation.
- [x] Prepare pinned QNLI and Shark Tank business-field subsets with source labels, attribution and provenance.
- [x] Add an automated Colab comparison run with grouped target-data evaluation and conservative model promotion.
- [ ] User runs the hosted Colab notebook and returns its measured evaluation/artifact. No local model training or deployment.

Completed details: public home and separate authentication screens; private dashboard per role; account-scoped MongoDB aggregation; no example/cohort/training data fetched for entrepreneur dashboards; automatic progress/feedback refresh and session-expiry cleanup. Public registration creates entrepreneur accounts and the assessor bootstrap explicitly sets its privileged role. The default database role is now entrepreneur.

Prepared external data: QNLI 600 training / 120 validation pairs, and Shark Tank 122 training pairs from 30 companies / 40 test pairs from 10 companies. Shark Tank is positive-only schema-derived supervision, not human-reviewed relevance or outcome data. Sources are revision-pinned and SHA256-checked, with exact provenance and separate holdouts. The original 48 reviewed target answers remain separate and unchanged.

The self-contained `training/external_cloud_training.ipynb` installs dependencies, downloads both datasets, caches hosted Gemini embeddings, trains target-only and auxiliary-data candidates, compares identical target business-family folds and downloads a results ZIP. It keeps the baseline unless measured target macro-F1, precision, recall, evaluation coverage and high-threshold flag checks pass. No new accuracy or successful training is claimed before the user runs it in hosted Colab.

Validation: 62 application tests, 15 Python data/notebook/promotion-rule checks and 11 desktop/mobile browser checks passed. The production build passed, and home/personal mobile screenshots were visually inspected. Live Atlas checks with two temporary entrepreneur accounts verified own-only dashboard counts, resistance to forged owner filters, protected sources, assessor access and review validation; temporary records/accounts were removed. No AI requests were made for these access checks and no deployment was started.

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
- [x] Execute cloud training and save measured results. User completed Colab training; returned files match the reviewed 48-row dataset and evaluation metadata.
- [ ] Connect and verify deployed inference. Deployment is user-owned; do not start it.

## Delivery
- [x] Add clearly labelled read-only examples for credential-free interface review.
- [x] Verify scoring, evidence rejection, provider failure states, source access guards, origin checks, and read-only API behavior.
- [x] Run TypeScript checks, 25 automated tests, production build, and four desktop/mobile browser tests.
- [x] Validate supplied formats: 42/42 PDFs opened (109 pages), 13/13 recordings decoded. Speech contents and translations are not yet verified.
- [x] Document local setup, API keys, Atlas, training, and deployment; create ignored `.env` with generated local secrets.
- [-] Verify live Atlas and AI integrations. Atlas, authentication, Gemini text/embeddings, and the approved 15-second Sarvam sample passed; four approved dataset PDF checks are running.
- [ ] Deploy and run presentation checks. Requires deployment access.

## Next external steps

1. Set `MONGODB_URI`, `GEMINI_API_KEY`, and `SARVAM_API_KEY` in the root `.env`. Do not paste credentials into chat.
2. Restart with `npm.cmd run dev`, sign in using the credentials in `.env`, and process one real sample of each format/language before bulk import.
3. Review and label answers; run `training/cloud_training.ipynb` in a hosted Colab session; inspect the actual metrics.
4. Deploy the exported model to a remote host, configure `MODEL_SERVICE_URL`, and run parity checks.
5. Deploy the application and verify the live demo.

Local UI screenshots: `.planning/screenshots/overview-desktop.png` and `.planning/screenshots/overview-mobile.png`. Live credentials were not present during implementation; no training, public deployment, or live provider results are claimed.

## Connection checks ? 18 October 2026

- Gemini API key accepted; configured generation and embedding models are listed as available.
- Sarvam accepted a generated one-second silent WAV. Real participant speech was not uploaded or tested.
- Atlas DNS resolved, but all three nodes reset the connection before authentication (`ECONNRESET`). Verify the project IP access list and network access before retrying.
- Added `npm run check:connections` and `npm run check:pipeline`; neither reads or uploads participant content. The latter uses an artificial English tea-stall example.
- Automatic approval review rejected the proposed participant-audio upload. Real dataset API tests require explicit approval before proceeding.

### Verified follow-up checks ? 18 October 2026

- User explicitly approved the 15-second participant-audio test. Exactly 15 seconds of a Hindi dataset sample was sent to Sarvam; a non-empty Hindi transcript was returned. Transcription accuracy is not yet manually verified. This approval does not extend to bulk dataset uploads.
- A synthetic English idea completed hosted source extraction and seven-dimension assessment. Reduced Gemini 3+ reasoning to configurable LOW and converted provider timeouts into retriable failures.
- Corrected the embedding request: nested settings returned 3,072 dimensions despite requesting 768; top-level options return the required 768. Verified the real application embedding function returns a normalized 768-dimensional vector. Updated cloud training code and notebook to match.
- Added stage reporting for processing jobs. Server build and all 25 automated tests pass.
- Atlas remains unverified: DNS resolves, but nodes return ECONNRESET before authentication. The user requested help locating the project IP access list; instructions provided. Await an Active current-IP entry before retesting.

### Atlas network follow-up ? 18 October 2026

- The user confirmed the current-IP entry is Active in the same Atlas project as Cluster0.
- Retest still returns ECONNRESET before authentication. All three SRV records resolve, IPv4 TCP connections to port 27017 succeed, but TLS and forced TLS 1.2 handshakes reset. TLS to the already-configured Gemini endpoint works.
- The user confirmed college/office Wi-Fi. Network filtering is a possible cause, not yet proven. Next controlled check: switch to a mobile hotspot and add that network?s current IP to the same Atlas access list before retesting.
- A proposed public-IP lookup to ipify was rejected by automatic approval review and removed. The completed diagnostic contacted only Atlas nodes and the already-approved Gemini endpoint.
- Atlas authentication and assessor sign-in remain unverified; application startup awaits the database connection check. No new participant content was uploaded in this follow-up.

### Hotspot follow-up — 18 October 2026

- On the mobile hotspot, Atlas DNS and TCP still succeed, but all three nodes reject default and TLS 1.2 handshakes with an internal TLS alert before authentication.
- With explicit user approval, queried this machine's public IPv4 through ipify. Await comparison of the exact address with the Active Atlas project IP access entry.
- Started the local frontend and API. The interface offers read-only examples while Atlas is unavailable; live sign-in and submissions remain blocked by the database connection.

### Atlas connection verified — 18 October 2026

- After the exact public IP was added to the Atlas access list, the configured URI connected and the database ping succeeded.
- Restarted the development frontend and API; Atlas initialization and assessor bootstrap succeeded, and the processing worker started.
- Verified through the frontend proxy: database health, assessor login, authenticated session, protected submissions list, and logout all returned HTTP 200. No credentials or session tokens were logged.
- The live workspace currently contains zero submissions. Dataset import, broader language/format validation, and hosted classifier training remain pending.

### Dataset checks and cloud-training guidance - 18 October 2026

- User explicitly approved uploading four specified dataset PDFs to Gemini and storing them in Atlas: English Example 3, Hindi Scenario 2, Marathi Business Idea 6 changed questions/answers, and Telugu Scenario 1 accurate answers. This approval is limited to those four PDFs.
- Uploaded those four files through the authenticated app API, with content hashes checked against the manifest. Background processing is running; source citation checks do not replace human translation review.
- Queued a separately labelled invented text idea to verify missing-revenue handling, supported clarification, source retention, and version history.
- Added `training/CLOUD_TRAINING_GUIDE.md` and linked it from the README. Reviewed training labels and a user-operated hosted Colab runtime remain necessary; no classifier has been trained or deployed.

### Reviewed training data prepared - 18 October 2026

- All four approved PDFs completed hosted processing. Their accepted values pass citation resolution and quoted-value checks; source PDFs downloaded from Atlas match the manifest hashes, support byte ranges, and reject unauthenticated access. Human transcription/translation verification remains pending.
- The separate synthetic assessment withheld its deliberately missing revenue. Its clarification request returned HTTP 500; a complete live Evidence Repair Loop check remains pending and has not been claimed as passed.
- Investigated the Colab minimum-data error: Atlas contained one relevant label from one business family, with no off-topic labels.
- At the user's request, reviewed selected answers from five supplied English PDFs locally. Prepared `data/training/reviewed-answers.jsonl`: 48 answers, 38 relevant, 10 off-topic, across five conservative source families (four identified business types plus one unidentified off-topic form). Every selected original question/answer matches its cited PDF page, and every source hash matches the manifest.
- These are assistant-reviewed labels, not independent expert ground truth. Off-topic examples cover only two source families. Excluded blank, overwritten, mixed-language and identifying fields; created no artificial answer pairs or duplicated training examples. Raw source PDFs were not uploaded in this preparation.
- This prepared JSONL is separate from the app's one saved Atlas annotation. The app's export exports only its saved workspace labels. Source decisions and audit are under ignored `.planning/`; the prepared JSONL is ignored too.
- Added explicit readiness counts to Model & training and a preflight cell before key entry in the self-contained Colab notebook. The notebook now reports exact shortfalls and rejects duplicate features before embedding calls.
- The actual prepared file passes the notebook's preflight. All 28 application tests and seven Python validation-only tests pass, as do workspace TypeScript checks and the client production build. No model training or inference ran locally, and no trained artifact or metrics have been generated.
- A live browser check confirmed that the new training-readiness notice matches the Atlas label counts after loading.

### Standardized inputs and separate accounts - 18 October 2026

- User explicitly took ownership of deployment and requested stronger input constraints, including separate entrepreneur accounts. No deployment was started. Deployment preparation introduced earlier in this turn was removed.
- Added public entrepreneur registration and role-bearing cookie sessions. Public registration cannot choose an assessor role; the programme bootstrap account remains the assessor entry point.
- Added server-assigned submission ownership and scoped record, original-file and clarification-source access. Entrepreneur accounts cannot use assessor review, verification, similarity, cohort or training endpoints.
- Added a guided entrepreneur form using the same schemas as the server: required business description, bounded optional fields, INR normalization including Indic digits, unknown versus zero, financial consistency, price units and explicit research status. Kept free text, PDF and audio input with file/length constraints.
- Standardized assessor reviews with explicit decisions, rationale, standard reasons, next actions, current source citations and source-review confirmation. Stale versions and unrelated evidence IDs are rejected.
- Added role-aware navigation and account views. Entrepreneur accounts do not receive the assessor's cohort/training tools or similar-submission data.
- Fixed ProviderError identification so hosted-model quota failures return an actionable retryable HTTP 503 instead of a generic HTTP 500.
- Live Atlas checks verified two temporary entrepreneur accounts, account isolation, original-source isolation, assessor access, financial validation and persisted structured reviews. All temporary accounts/records were removed; no model calls were made by these checks.
- Returned model files report macro-F1 0.6783, off-topic recall 0.40, full grouped evaluation coverage and zero flag coverage at threshold 0.75. Model remains advisory and hosted inference is not connected.
- Final verification: 40 application regression tests, nine desktop/mobile browser tests, workspace type checks and the full production build passed. The guided mobile form was visually inspected. Existing assessor access remains functional and no real participant records were modified during the role checks.

### Gemini quota handling - 18 October 2026

- Diagnosed the reported HTTP 429 with a synthetic prompt. Google returned `RESOURCE_EXHAUSTED`, a daily free-tier allowance of 20 requests for `gemini-3.8-flash`, and a retry delay. No participant content was sent for the diagnosis.
- Added safe quota parsing, `Retry-After`/`RetryInfo` support, separate generation/embedding cooldowns and configurable request spacing. Daily quota without a reset time and zero allowances require an explicit administrator check; no billing or model configuration was changed.
- Added a durable generation cooldown in Atlas and next-attempt metadata on submissions. The processing screen now explains the wait and displays its scheduled retry, without an active processing spinner.
- Added content/model-bound checkpoints for successful transcription, source reading and extraction, retained across automatic and manual retries and removed after successful completion. Evidence validation still runs before publishing an assessment.
- Recovered the user's existing failed submission through its authenticated retry endpoint. It is queued with zero new attempts, original text unchanged, and no fabricated assessment. Google's reported next retry time is 18 October 2026 at approximately 05:30 IST; this is the returned retry time, not a promise that quota will be available then. The server must remain running or be restarted after that time.
- Verification: 48 automated tests, 10 desktop/mobile browser tests, workspace type checks and the full production build passed. The quota waiting screen was visually inspected. Live recovery results are recorded in ignored `.planning/quota-recovery-check.json`.
- Full live reprocessing remains pending the external provider's quota. No deployment was started.

### Account security and system design - 18 October 2026

- Made Sign out a labelled header button on desktop and mobile. Added browser sign-out, all-device sign-out and password changes under Settings → Account security.
- Added atomic session-version revocation, cookie rotation, immediate expiry checks, password-change race protection and cross-tab workspace cleanup. Failed sign-out keeps the account available for retry rather than falsely confirming revocation.
- Added server-generated request IDs, cross-site mutation rejection, liveness/readiness endpoints and bounded HTTP/worker shutdown with Atlas disconnection. Test-mode startup disables Atlas and background processing.
- Documented authentication, ownership boundaries, durable jobs, evidence validation, operating limits and future scaling requirements in `SYSTEM_DESIGN.md`.
- Verification: 74 application tests, 18 desktop/mobile browser tests and the full production build passed. Session-storage tests use controlled fixtures; live Atlas revocation was not exercised in this turn. No deployment or participant/model-provider calls were made.

### Groq fallback - 18 October 2026

- At the user's request, added Groq as a hosted generation fallback for Gemini quota, configuration/access and temporary network/service failures. Stored the supplied key only in the ignored server-side `.env`; no client key or deployment was added.
- Default Groq model is `openai/gpt-oss-120b`, using strict JSON schema output, temperature zero and bounded output. Existing schema checks, exact source quotes, numeric translation checks, citation checks and deterministic assessment still apply. Blocked, incomplete or invalid Gemini output is not automatically routed around validation.
- Written text and Sarvam speech transcripts use the text fallback. Added Mozilla PDF.js for deterministic extraction of PDF text with page numbers; Groq PDF quotes must match their cited page. Scanned, blank or unreadable PDF pages fail explicitly instead of being silently dropped. No local model or OCR model runs.
- Gemini embeddings remain fixed for trained-classifier compatibility. Groq never substitutes embeddings; unavailable similarity/classifier checks are disclosed as optional failures.
- Added separate provider cooldowns, Groq retry/reset-header handling, queue resumption when a provider becomes available, accurate provider attribution and a Groq connection indicator. Added `npm.cmd run check:groq` for synthetic access checks.
- Synthetic Groq access/strict JSON check passed. The previously blocked Marathi text submission completed through Groq: 15 segments and 10 supported fields. All accepted values match cited evidence; status is `needs_review`, with no processing error and no remaining checkpoint. This does not establish human-verified translation accuracy.
- Verification: 61 automated tests, 10 browser tests, workspace type checks and the production build passed. No deployment was started.

### Database availability recovery - 18 October 2026

- Diagnosed the blocked sign-in and registration: the running API reports database unavailable. A direct read-only Atlas connection fails with `ECONNRESET`; DNS and TCP succeed for all three nodes but default and TLS 1.2 handshakes fail before password authentication. No credential failure or successful connection is claimed.
- Added serial retries after initial Atlas connection/initialization failures with exponential backoff capped at 30 seconds, safe diagnostic categories, and cancellation/draining during shutdown. The API remains reachable during connection attempts.
- Added automatic availability checks on signed-out pages and a manual Check connection action. Login and registration enable after recovery without losing typed form input.
- Verification: 78 application tests, 21 browser tests and the full production build passed. Browser checks used a separate test-mode API with Atlas and the worker disabled. No participant content was sent to providers and no deployment was started.
- The actual Atlas connection remains blocked by TLS resets. Requested confirmation of the current network IP in the same Atlas project's access list; a network/access-list correction remains necessary.

### Development proxy startup and service recovery - 18 October 2026

- Confirmed the user's ECONNREFUSED log indicates a period with no API listener. At inspection, direct and Vite-proxied liveness/session requests returned HTTP 200, with Atlas still unavailable.
- Updated the single development command to wait for API liveness before starting Vite. The startup check and proxy share API port validation; occupied frontend ports fail clearly. The check does not require Atlas, so database outages do not prevent the public site starting.
- Fixed recovery after an initial session request fails before any session exists. Account pages now distinguish service unavailability from database unavailability, recheck automatically, preserve typed input and retain manual retry.
- Verified 81 application tests and 24 browser tests. Browser responses were mocked; direct and proxied live API requests were checked separately. No model-provider calls or deployment were made by these checks.

### Atlas access restored - 18 October 2026

- The supplied Atlas screenshot showed only `106.192.59.143/32` and `182.76.246.162/32`; the API machine's verified public IP was `223.228.59.139`. The user added that exact `/32` entry and confirmed it became Active.
- Verified a successful authenticated Atlas connection and ping. The existing API reconnected automatically; direct and Vite-proxied session endpoints both returned HTTP 200 with database available.
- Verified live entrepreneur registration, authenticated session, logout, subsequent login and logout through the frontend proxy using a generated temporary account. Every request returned HTTP 200 and the registered role was entrepreneur. Removed only that generated account and its sessions after the check.
- No participant records, hosted model calls or deployment were involved in these verification checks. The unrestricted access-list diagnostic was declined and was not used.

### Complete missing-parameter questions - 18 October 2026

- Added specific questions and answer guidance for all 19 business parameters. Pending questions derive from validated field statuses, include unclear/off-topic answers, prioritize conflicts and exclude supported answers. Removed the previous three-question cap and omissions for trade, sector, materials, own investment, funding and monthly costs.
- Added Complete missing information to the assessment page with a per-parameter Answer action and answer counts. The existing text/audio repair dialog selects the chosen parameter and continues after each successful answer; completed questions disappear. All-answered inputs show no follow-up fields. Short answers such as zero are allowed, and the prompt receives question context without treating it as evidence.
- Expanded pending lists on reads for existing saved assessments and on server-side clarification eligibility without reprocessing originals or changing historical scores. Exact quotes, evidence links, account scoping and version checks remain enforced; provider-invented values cannot close questions.
- Verification: 89 application tests and 29 desktop/mobile browser tests passed; production build passed. Integration tests use controlled storage/provider fixtures and verify zero answers, previously omitted fields, stale versions, source/history preservation and rejection of invented facts. The mobile dialog was visually inspected. No participant data uploads, model training or deployment were performed.

### Assessor risk and nearby business support - 18 October 2026

- Added an assessor-only decision-support API and assessment panel: explainable financial risk screening, coverage, source links, projected monthly surplus/margin, sales/cost stress, funding-plan gaps, evidence-review counts, conflicts and qualitative follow-up checks. Financial rules are disclosed and are not presented as calibrated failure probabilities or lending recommendations. Missing/unsupported figures remain unavailable.
- Improved nearby-business lookup with 12 confirmed categories, place confirmation, distance/source links, radius selection, category-tag validation, result limits and stale-result clearing. Added a second bounded public Overpass endpoint. Partial/failed responses cannot masquerade as zero competition; mapped listings never change the financial risk score.
- Verified 101 application tests and 33 desktop/mobile browser tests, including financial arithmetic, conservative amount handling, risk coverage, endpoint access, map validation/fallback and UI recovery. The mobile assessor panel was visually inspected.
- A generic live Pune geocoder query succeeded. Actual Overpass listings were unavailable during live checks: the primary endpoint timed out and the fallback returned server errors. This external limitation remains visible as an error; no live competitor list or complete local-market coverage is claimed. The map behavior otherwise passed controlled provider/browser tests.
- No participant content was sent to model providers, no local model ran and no deployment was started.

### Guided preparation and follow-up usability - 18 October 2026

- Reorganized guided input into business/customers, operations, financial assumptions and research sections. Added section links, a labelled entry counter, live surplus/funding-plan arithmetic and shared-schema feedback. Preparation tools stay open in the desktop sidebar and start collapsed on mobile/tablet. Unknown amounts remain distinct from zero.
- Added normalized submission previews using the same serializer as the server, with continue-editing, text-summary download and submission through the existing validated flow. Previews do not call AI providers or save records. Invalid input focuses the first affected control and preserves entered values.
- Added missing-question category filters, text search, reset actions and expandable answer guidance. Download checklist creates a version-labelled text worksheet containing outstanding questions, supported source-linked facts and saved assessor feedback. Downloads do not change the assessment and no drafts are stored in browser storage.
- Improved keyboard focus, contrast, responsive action buttons and reduced-motion behavior while preserving the white/black/neutral design. Desktop and mobile screenshots were visually inspected; the mobile preparation panel was shortened after review.
- Verification: 105 application tests, 38 browser tests and the production build passed. Tests cover arithmetic/unknowns, filtering, exports, preview without a write, error focus, editing preservation and a single submission from the preview. No deployment, model training or participant/provider uploads were performed.
