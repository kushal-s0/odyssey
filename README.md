# STRIVE — Business idea assessment

A MERN application for the Tata STRIVE hackathon problem statement. It accepts text, PDFs and recordings, preserves originals in MongoDB Atlas, and produces an assessment with source references. The **Evidence Repair Loop** asks targeted clarification questions and preserves each assessment version.

The UI uses white, black and neutral grays. All AI inference uses hosted services. No local LLM, embedding model, speech model or trained classifier is started by the application.

## Map, evidence and screening workflow

Measured checks and remaining validation limits: [EVALUATION_RESULTS.md](EVALUATION_RESULTS.md).

- Open an assessed submission → **Similar ideas & local context**. Confirm the place or enter confirmed coordinates, choose a category and radius, then select a numbered marker or matching listing. Location settings persist per submission; Leaflet loads only when the map is needed.
- Add `GEOAPIFY_API_KEY` to the root `.env` for managed nearby lookup; restart the API after environment changes. Geoapify Places is preferred when configured, with bounded public Overpass fallback. Keys stay on the server and are excluded from source URLs and exports. See [Places documentation](https://apidocs.geoapify.com/docs/places/) and [plan/attribution requirements](https://www.geoapify.com/pricing/).
- Failed lookup can fall back to a matching cached result up to seven days old, with its original retrieval date and a stale warning. Otherwise the app reports unavailability. Failure never becomes zero competitors. Tiles, business listings and manual observations have separate availability states.
- Assessors can save separately labelled manual observations: business name, coordinates, public source link, note and source-check status. Dashed markers distinguish them from provider results. Observations are audit logged, remain assessor-only and never change financial risk.
- **Source evidence** now supports original/English comparison, highlighted extracted quotations, linked parameters, PDF page/audio passage links, search, verification filters, multiple selection, previous/next navigation, copy/download and an expanded keyboard-accessible dialog. Confirming fidelity requires selected sources and an explicit comparison with originals. Source fidelity does not establish the truth of business claims.
- **Information readiness** is separate from provisional screening concerns and **assessor-rated business potential**. A screening summary explains financial concerns, missing information and a suggested next action. Assessors can rate six domains with reasons and current source citations. Unknowns stay unrated; an aggregate requires all six current ratings. Weights: clarity 15%, customer need 20%, market potential 15%, feasibility 25%, competition 10%, differentiation 15%. These are human screening opinions, not calibrated success probabilities. Evidence revisions invalidate old reviews.
- **Assign programme cohort** in the assessment header supports existing entrepreneur submissions. Only assessors assign actual membership. Comparison views/CSV show readiness separately from current human potential ratings, domain medians and rated sample counts.
- Free text is the default intake mode. Guided input, audio and PDF remain available. Missing questions can be answered in stages; all unresolved parameters remain accessible.

Live verification: the synthetic clarification flow passed source retention, history and stale-version checks. Temporary Atlas fixtures passed cohort assignment, local-context persistence, observation lifecycle, domain-review persistence and evidence-version invalidation, then were removed. A generic Pune query returned 71 Geoapify food listings within 1 km with radius checks and provider/source IDs. This does not establish exhaustive market coverage. Independent language-quality checks, assessor time savings and capacity validation remain pending. Deployment is user-owned.

## Run it

Node.js 22.13 or newer and Python 3 are needed. On this Windows machine, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd run dev
```

Open **http://localhost:5173**. The Express API runs at **http://localhost:4000**. Vite proxies API requests, so cookies remain on the same browser origin.

After setup, **`npm.cmd run dev`** is the single command to start both the React frontend and Express API. The frontend waits for API liveness before starting, avoiding proxy errors during the API's initial imports. This check does not wait for Atlas; the site can explain database unavailability while Atlas reconnects. The proxy and startup check both use `PORT` from the root `.env` (default 4000). The frontend uses port 5173 and fails clearly if it is already occupied. Press **Ctrl+C** to stop both. If either process exits, the other is stopped automatically. For a production build, `npm.cmd run build` followed by `npm.cmd start` serves the frontend and API together from Express on port 4000.

`ECONNREFUSED 127.0.0.1:4000` in Vite means the API was not listening at that moment; inspect the `[api]` output. It differs from an Atlas connection failure, where `/api/health/live` responds but `/api/health/ready` returns 503. Account pages distinguish service unavailability from database unavailability and retry failed initial session requests automatically.

The public home page is available without signing in. **Sign in** opens the appropriate private dashboard; **Get started** creates an entrepreneur account. Workspace pages require authentication. Entrepreneurs see only their own ideas, scores, statistics, clarification requests and feedback; assessors have the programme overview and review tools. A missing database never causes a fallback to a local database. The public examples API retains eight labelled synthetic test/demo records, but private dashboards do not fetch or count them.

## Configure the live workspace

The **Sign out** button is in the header on desktop and mobile. **Settings → Account security** also offers browser-only logout, all-device logout and password changes. Logout invalidates stored sessions; password changes require your current password and sign out existing devices. See [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) for session lifecycle, role isolation, durable jobs, request IDs, readiness and shutdown behavior.

Routes: `/` public home, `/login` sign-in for both roles, `/register` entrepreneur registration, `/dashboard` personal or programme dashboard, `/submissions` account-scoped ideas. The server decides account roles and ownership; query parameters cannot change the dashboard's scope. Sign-out and expired sessions clear browser workspace data and return to sign-in. Dashboard updates run automatically while the page is visible, with faster polling during processing.

`npm run setup` creates an ignored root `.env`, generates a session secret and initial assessor password, and does not print secrets. It preserves any existing `.env`. Open the file in your editor and set:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas `mongodb+srv://...` connection URI with read/write access to the chosen database |
| `MONGODB_DB` | Database name; defaults to `strive_screening` |
| `SESSION_SECRET` | At least 32 characters; generated by setup |
| `ASSESSOR_EMAIL` | Initial assessor account; default `assessor@example.com` |
| `ASSESSOR_PASSWORD` | At least 12 characters; generated by setup |
| `GEMINI_API_KEY` | Hosted document extraction, translation and embeddings |
| `GEMINI_MODEL` | Account-accessible multimodal model; configured default is `gemini-3.8-flash` |
| `GEMINI_THINKING_LEVEL` | `LOW` by default for Gemini 3+ structured extraction; configurable to `MEDIUM` or `HIGH` |
| `GEMINI_EMBEDDING_MODEL` | Fixed embedding model; default `gemini-embedding-001`, 768 dimensions |
| `GROQ_API_KEY` | Optional hosted fallback when Gemini generation is unavailable; server-side only |
| `GROQ_MODEL` | Strict JSON model on Groq; default `openai/gpt-oss-120b` |
| `GROQ_MIN_REQUEST_INTERVAL_MS` | Minimum Groq request spacing; default 3000 ms per API process |
| `GROQ_MAX_COMPLETION_TOKENS` | Groq output budget; default 4096; subject to account limits |
| `SARVAM_API_KEY` | Indian-language speech transcription, including Odia |
| `SARVAM_MODEL` | Speech model; default `saaras:v4`; verify account access |
| `AUDIO_PROVIDER` | `sarvam` by default; explicit `gemini` alternative available |
| `APP_URL` | Browser origin; development default `http://localhost:5173` |
| `MODEL_SERVICE_URL` | Optional deployed classifier endpoint; configure after actual cloud training |
| `MODEL_SERVICE_TOKEN` | Shared secret for the remote classifier, generated by setup |
| `OSM_USER_AGENT` | Set an identifying application name and contact before live location lookup |

In Atlas, allow the development machine's current public IP through the project's Network Access list and create a database user with access to this database. Restart the API after editing `.env`, then use **Sign in** with the configured assessor credentials. The first assessor account is created only when none exists; editing its bootstrap password later does not reset an existing user.

If both sign-in and registration show that the database is unavailable, check `/api/health/ready`. Initial Atlas connection failures retry automatically with delays of 5, 10, 20 and then 30 seconds between attempts. Signed-out pages recheck availability every 10 seconds while visible and provide **Check connection** without discarding typed input. A network or access-list correction does not require an API restart. `DATABASE_NETWORK_FAILED` in the server log means connection establishment failed; `ECONNRESET` during TLS does not verify the database password. Check the current IP in the same Atlas project and any network filtering. `DATABASE_AUTHENTICATION_FAILED` instead indicates rejected database credentials.

Entrepreneurs can register and access their own submissions and originals. Assessors review programme submissions and manage training annotations. API permissions enforce these roles and ownership.

Provider configuration status is not proof of API access. The first real request verifies account/model availability and quota. No API keys, Atlas URI, cloud session, or deployment credentials were available during initial implementation, so live external integrations and actual training must still be exercised with your accounts. Free allowances are finite; Gemini free-tier data-use terms differ from paid-tier terms.

## Workflow

1. Create a programme cohort in Settings when its membership is known, or leave it unassigned.
2. Submit text, a PDF, or a recording. PDF/recording limits default to 10 MB; PDFs allow up to 25 pages. Uploaded recordings support up to 20 minutes; browser recording allows five minutes.
3. Atlas stores the original in GridFS and queues a durable job. The API worker reads/transcribes, translates, extracts quoted facts, validates source references and applies a deterministic rubric.
4. Open the assessment and inspect English/original segments or the original PDF/audio/text. AI transcription/translation remains marked for verification.
5. Open an assessment's **Complete missing information** section. Each of the 19 business parameters has a specific question, and only unanswered, unsupported or unclear parameters are shown. Extracted answers are excluded; there is no three-question limit. Choose **Answer** beside a parameter or **Resolve gaps**, then type or record the answer. Validated answers remove their question and the dialog continues with remaining questions. The original clarification is retained; the previous assessment remains in history. Concurrent edits are rejected using the version number.

The pending list covers business idea, trade, sector, products/services, customers, customer need, location, materials/equipment, suppliers, total investment, own investment, external funding, unit price, monthly sales, monthly costs, research, competition, differentiation and experience. Currency questions request INR and the relevant unit/period. Explicit zero amounts are accepted; unknown answers remain unresolved. An explicit statement that research has not yet been done counts as an answer, but does not earn market-research evidence credit. The 19-parameter answer count is separate from the existing rubric's core-information completeness percentage.

The guided form has four named sections with jump links and a preparation panel. Its 16-entry counter tracks guided form details, not an assessment score or the separate 19-parameter assessment. The panel shows live arithmetic from entered financial assumptions and input-schema checks, leaving unknown amounts uncalculated. Preparation tools start collapsed on mobile/tablet so users can reach the form quickly.

Use **Preview submission** or **Preview standardized input** to inspect the normalized text before submission. Guided previews reuse the server's serializer, so INR amounts, monthly periods and omitted unknown answers are represented consistently. Previewing does not save or call a provider. Users can continue editing, download a text summary, or submit through the normal validated flow. Input errors focus the first affected field.

In **Complete missing information**, filter questions by business, operations, finances or market, search their text and open answer guidance when needed. **Download checklist** produces a version-labelled text worksheet with outstanding questions, stated facts, source IDs and any saved assessor feedback. Filling in the downloaded worksheet does not update the website; answers must be saved through the clarification flow. Neither tool puts submission drafts in browser storage.

Question selection uses a shared fixed question bank and validated field statuses. Existing stored assessments receive the full pending list when read, without uploading or reprocessing the original. Clarification still uses hosted transcription/translation and extraction, exact source-quotation validation and version checks; arbitrary answers do not automatically become supported facts. Provider failures leave the existing assessment unchanged.
6. Assessors can open **Assessor decision support** for financial screening, follow-up checks and linked evidence. Choose **Find nearby similar businesses**, confirm the place and category, then search a 1, 3 or 5 km radius. Programme submission comparisons remain available separately.

The assessor panel reports projected monthly surplus and margin, a funding-plan gap, a stress scenario (20% lower sales and 10% higher costs), source-review counts, unresolved conflicts and checks for research, competition, differentiation, suppliers and experience. The **financial risk score** is a deterministic screening rule, not a probability of failure or a recommendation to lend. Margin headroom contributes 50%, stress resilience 25%, and funding-plan consistency 25%; the UI shows each factor's 0–4 concern points and explanation. Unknown values are excluded and at least 50% rule coverage is required. Requested external funds are not treated as approved funding. Financials come only from source-validated quotations; multiple amounts, incompatible periods and unsupported currency formats stay unavailable.

Nearby listings use OpenStreetMap categories across 12 business types, with name, straight-line distance and original source links. The assessor confirms the category because a mapped match is not necessarily a direct competitor. Listings can be duplicated, incomplete or outdated; zero results do not mean zero competition. Queries are cached and bounded to 100 returned features, with a cap warning. Changing location, category or radius clears old results. A second public Overpass endpoint is tried on failure; if both fail, the app reports unavailability. No listing counts are included in the financial risk score. See [OSM attribution](https://www.openstreetmap.org/copyright), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) and [public Overpass instances](https://wiki.openstreetmap.org/wiki/Overpass_API).

Sarvam recordings are decoded with the bundled FFmpeg binary into 25-second mono WAV chunks. Chunk times are approximate boundaries, not word-level alignment. A missing FFmpeg binary can be replaced with `FFMPEG_PATH`. Install dependencies normally so the correct platform binary is present. Speech quality and translation quality must be checked on the supplied languages, especially Odia and mixed-language recordings.

## Evidence and scoring

Account roles and standardized entrepreneur/assessor forms are documented in [Input standards](INPUT_STANDARDS.md). Entrepreneurs can create their own accounts in Settings; assessor access remains programme-provided. The API enforces ownership, financial consistency and evidence-backed review requirements.

- A supported value must be an exact continuous quotation from a cited English or original source segment. Unsupported proposed values are withheld.
- Original text segments must match the submitted text. PDF page references are checked against the document page count.
- Translation numeric mismatches are flagged, and the mismatched translation is withheld while the original remains available.
- Missing, ambiguous and off-topic responses remain distinct. Competing explicitly overwritten money values trigger clarification.
- Seven dimensions are visible. The six business dimensions use fixed weights; completeness is reported separately. No dimension evidence means “Not assessable.” An aggregate needs at least 70% weighted coverage and no critical conflict.
- The current rubric measures **supporting-information readiness**. Its highest fully described business-dimension anchor is 3/4, giving a maximum weighted aggregate of 75 in this MVP. The fourth anchor is reserved for a future independently validated evidence standard. This is deliberately documented rather than presenting information coverage as a probability of success.
- A statement that no research was done is retained faithfully but does not count as market-research evidence.
- Source verification checks transcription/translation fidelity. It does not verify that an applicant's sales forecast or market claim is true and does not automatically increase the score.
- Similarity uses hosted embeddings when compatible vectors exist and an explicitly labelled keyword fallback otherwise. Versions/duplicate files and reviewed source families are excluded where identifiable.
- Cohort membership is supplied by the programme. Comparison tables separate rubric versions, show sample counts, and avoid small-group percentile rankings.

No system can promise zero hallucinations. Exact citations also cannot prove semantic correctness or the truth of a beneficiary claim. Human review, visible uncertainty, source access and failure states remain part of the workflow. There is no automatic funding decision.

## Supplied dataset

The source folder contains 55 files: 42 PDFs and 13 recordings. The PDF set has 109 pages, including four 11-page scanned Hindi documents. Other PDFs have missing Indic text/font mappings, so the application sends the visual PDF to the hosted document model rather than trusting ordinary text extraction.

Prepare a manifest and safely extract files by content hash:

```powershell
npm.cmd run dataset:inventory -- --extract
```

This creates `data/manifest.json` and ignored `data/extracted/`. It does not call any API or train a model. Filenames and scenario names are not automatic training labels.

After configuring Atlas and provider keys, preview an import:

```powershell
npm.cmd run dataset:import -- --limit 3
```

Save and queue those files with:

```powershell
npm.cmd run dataset:import -- --limit 3 --execute
```

The running API processes queued jobs. Increase the limit after the first samples work. Imports deduplicate by file hash and leave cohort membership unassigned. A reviewed `sourceFamily` can be entered in the manifest with `groupReviewed: true` before import to keep known translated/revised families together for similarity exclusion. The Model & training screen separately requires a group ID when labelling answers.

## Train the custom model in the cloud

Follow the step-by-step [Colab training guide](training/CLOUD_TRAINING_GUIDE.md) for notebook upload, reviewed labels, runtime selection, and artifact downloads.

The supplied data does not include expert viability ratings or business outcomes. The trained component is therefore a narrow supervised **response-relevance classifier**. Its input is business context, question and answer. Labels are `0 = relevant`, `1 = off-topic`. Blank/ambiguous values are handled by validation, not by inventing answers.

1. Process real source submissions, check the transcripts, and label individual answers in **Model & training**. Assign the same `groupId` to related translations, revisions and scenario variants. Avoid adding identifying profile information to training content.
2. Export reviewed answers from the UI, or run `npm.cmd run training:export` with Atlas configured.
3. Upload `training/cloud_training.ipynb` to [Google Colab](https://colab.research.google.com/) and connect to a **hosted runtime**, not a local runtime. CPU is sufficient. The embedded script explicitly refuses ordinary local execution.
4. Run the notebook, upload the exported JSONL file, and enter the API key through its hidden prompt. At least 20 reviewed answers, four business families, and five examples of each class are required. These are minimum execution gates, not a guarantee of statistical adequacy.
5. The notebook calls the hosted embedding API, trains regularized logistic regression in Colab, and evaluates with grouped out-of-fold predictions. Hyperparameter C is fixed, avoiding a tuned score presented as held-out accuracy. Invalid folds and evaluation coverage are disclosed. Inspect the small-data limitations.
6. Download the actual `model.json`, `evaluation.json`, and `parity-vectors.json`. No trained artefact or invented metric is shipped in this repository.
7. Deploy the model service remotely and check its output against the downloaded parity vectors before connecting it to the app.

Hugging Face augmentation is optional and outside the critical path. Adding an unrelated startup-funding dataset would not create trustworthy labels for these proposals. Any future external data needs task/language/licence and duplicate checks.

## Remote classifier deployment

Deploy `model-service` separately on a Node-compatible cloud host. **Do not start it on the development laptop.** It refuses startup unless `REMOTE_MODEL_RUNTIME=true` is explicitly set on the remote host.

Build from the repository root:

```sh
npm ci --ignore-scripts
npm run build -w model-service
node model-service/dist/index.js
```

Cloud environment:

```text
REMOTE_MODEL_RUNTIME=true
NODE_ENV=production
MODEL_ARTIFACT_PATH=/etc/secrets/model.json
MODEL_SERVICE_TOKEN=<same private token as the main API>
PORT=4100
```

Upload the real cloud-trained `model.json` as a host secret file at the configured path, or use your host's private artefact mechanism. A Dockerfile is also provided; its build context is the repository root. The service loads coefficients only on the remote host and exposes:

- `GET /health`: actual artefact readiness, version, feature compatibility and evaluation metadata.
- `POST /predict`: bearer-token protected; checks embedding model, feature version, dimension and finite numeric values.

The app rejects incompatible models. A missing/unavailable classifier is disclosed and does not fabricate predictions. Off-topic scores are advisory, not calibrated confidence in truth. The actual trained model cannot be verified until the cloud run and remote deployment have occurred.

## Local business context

The user explicitly searches for and confirms a business location, then chooses the business category and radius. Nominatim lookups are cached and limited to one per 1.1 seconds per API process; run a single process for this public-service MVP. No autocomplete or bulk geocoding is used. Overpass returns sourced OpenStreetMap listings with retrieval time, radius and attribution. No returned listings means **no mapped results found**, not no competitors. Public service availability and map coverage vary.

## Checks

For the automated external-data model comparison, open [training/external_cloud_training.ipynb](training/external_cloud_training.ipynb) in hosted Google Colab and choose **Run all**. Upload `data/training/reviewed-answers.jsonl` when prompted. The run downloads pinned QNLI and `isaidchia/sharktank_pitches` data, uses hosted embeddings, and exports a baseline/candidate comparison with a conservatively selected artifact. See [training/EXTERNAL_DATA.md](training/EXTERNAL_DATA.md) for source labels, licensing, split controls, quotas and model-promotion conditions. New accuracy is unmeasured until that hosted run finishes. No training or inference runs locally.

With `GROQ_API_KEY` configured, Gemini generation falls back to Groq on quota errors, network failures, temporary service errors, missing Gemini credentials or denied model access. Groq uses [strict JSON schema output](https://console.groq.com/docs/structured-outputs); unsupported source quotes, citations, numbers and financial claims still pass through the same evidence checks. Blocked, truncated or invalid Gemini output fails validation without automatically resubmitting it to another provider. The assessment records the actual source/extraction models used.

The fallback supports written answers, existing Sarvam speech transcripts and PDFs with selectable text. PDF.js extracts the PDF text with page numbers, and every Groq original quotation must match its cited page. Image-only, blank or unreadable pages fail explicitly; OCR is not silently invented. Raw audio requires the configured Sarvam transcription path before Groq. Gemini embeddings remain unchanged to preserve compatibility with the cloud-trained relevance classifier; embedding failure disables that optional check/similarity rather than substituting incompatible vectors.

Run `npm.cmd run check:groq` for a synthetic structured-output access check without participant content. Restart the API after changing `.env`. Adding a Groq key releases jobs delayed solely by Gemini's quota. Groq also has [finite account limits](https://console.groq.com/docs/rate-limits); the worker respects its retry and reset headers, stores separate cooldowns and resumes when either configured provider becomes available. Request spacing is per API process; use one API process for the hackathon.

Gemini HTTP 429 means the Google project's allowance has been exceeded. Check the active model's limits in [Google AI Studio](https://aistudio.google.com/usage?tab=rate-limit); quotas are shared across API keys in the same project. Daily request quotas reset at midnight Pacific time, according to [Google's rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

The worker reads `Retry-After`, `RetryInfo` and quota details. Temporary limits schedule a retry; daily exhaustion with a provider reset time waits until that time. A zero allowance or daily exhaustion without a reset time requires an administrator check and explicit retry. The next scheduled attempt appears on the submission screen. Successful source reading/transcription and extraction are checkpointed in Atlas, bound to the source content and model, and reused on retries. Checkpoints are removed after success. The server also saves model cooldowns in Atlas so restarting does not cause a burst of requests. Changing keys within the same Google project does not increase its allowance.

`GEMINI_MIN_REQUEST_INTERVAL_MS` defaults to 12000 (five request starts per minute per model, per API process). Adjust it to your actual allowance; spacing does not increase daily or token quotas. Run one API process for this hackathon setup, since request spacing is per process. After checking or changing provider configuration, use **Retry processing** for failed submissions. Queued submissions resume automatically after their displayed wait; leave the server running. Credentials stay in `.env`; no re-upload is needed.

With credentials configured, `npm.cmd run check:connections` checks Atlas, Gemini model access, and Sarvam using a generated one-second silent WAV. `npm.cmd run check:pipeline` exercises generation and embeddings using an artificial English business idea. These diagnostics do not read or upload participant content and do not print secrets. Connection reports are saved under ignored `.planning/` files. A successful silence request validates access, not real transcription quality.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The tests cover unsupported values, invented citations, missing/ambiguous values, conflicting revenue, numeric translation drift, invalid PDF page references, incomplete provider output, deterministic rubric arithmetic, preservation of original evidence, read-only example data, unavailable database behavior, request-origin checks, source protection and an untrained remote model service. Provider tests mock HTTP responses and do not make live model calls.

For browser checks, start the built application with `npm.cmd start`, then in another terminal:

```powershell
npm.cmd run test:ui
```

On Windows, Playwright uses installed Microsoft Edge. On other platforms install a Playwright browser or select an installed channel using `PW_BROWSER_CHANNEL`. `PLAYWRIGHT_BASE_URL` defaults to `http://127.0.0.1:4000`. Browser tests cover desktop/mobile navigation, filtering, input modes, comparisons, settings and read-only clarification behavior. Screenshots and test output go to ignored `.planning/` paths.

## Production deployment

The main application serves the built React app from Express. `render.yaml` is a starting deployment manifest:

```sh
npm ci
npm run build
npm start
```

Set `NODE_ENV=production`, `APP_URL` to the deployed HTTPS origin, Atlas and provider secrets, and the bootstrap assessor configuration. Express binds to all interfaces in production. Sessions use secure HTTP-only cookies; the API checks mutation origins. Uploaded files and job state persist in Atlas, not the hosting filesystem. Free hosting can sleep; verify readiness before presenting. No deployment has been created automatically.

Review `TASKS.md` for completed implementation and external steps still awaiting credentials/cloud access. `IMPLEMENTATION_PLAN.md` retains the detailed design decisions.
