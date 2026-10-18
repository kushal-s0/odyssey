# Free demo deployment walkthrough

Prepared 18 October 2026 for the actual React + FastAPI + Supabase + owned-laptop worker configuration. **No public application deployment has been performed.** Publishing source/builds, connecting an auto-deploying repository, creating a public endpoint or pushing Git still requires Kartik's explicit approval. The Supabase migration approval covered migration 006 only; it was applied successfully and did not authorize publication.

The local product/build/model evidence is recorded in task reports. These instructions describe the deployment to perform after approval; they are not a claim that deployed acceptance/recovery has passed. NLLB is a noncommercial research-model selection; review [model provenance](../models/PROVENANCE.md) before broader use.

## 1. Understand the selected services

| Component | Target | What runs there |
|---|---|---|
| Frontend | Cloudflare Pages static deployment | Only the Vite `apps/web/dist` output |
| API | Render **Free** web service | Small CPU FastAPI container; no GPU/model weights |
| Persistence/login/files | Existing Supabase **Free** project | PostgreSQL, trusted profiles/cohorts, Auth and private originals |
| OCR/speech/translation/extraction/rating | Owned NVIDIA laptop | Operator-started authenticated worker, pinned local weights and durable API leases |
| Optional explanation | Groq free-plan project | Bounded English/Hindi explanations; missing quota does not erase assessments |
| Nearby listings | Configured public OSM provider | Explicit coarse-area queries, shared limits, attribution and cache |

This is **laptop-backed inference**, not a fully cloud-hosted or unlimited service. Do not create Render Postgres, Redis, a paid background worker, GPU instance or another application database. Secondary Hugging Face deployment and large-scale experiments remain separate unverified/deferred targets.

Current primary service references were checked: [Render Free](https://render.com/docs/free), [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Supabase deployment checks](https://supabase.com/docs/guides/deployment/going-into-prod). Provider terms/quotas can change; verify the selected plan in its dashboard before deploying.

Render Free sleeps after idle traffic and has monthly instance-hour/build/bandwidth limits and ephemeral files. Its documentation advises against production use. Keep persistent application data in Supabase. Verify billing/spend controls and avoid adding a payment method/add-on that can turn excess usage into charges. Public free services must never be used for load testing.

## 2. Verify the existing checkout locally

Remain on branch `second` of `https://github.com/kushal-s0/odyssey.git`. Preserve the original organizer archives and existing historical commits. Use the configured Kartik author/committer for any new local commit; no attribution trailers. Do not push.

```powershell
git remote -v
git branch --show-current
git status --short
.venv/Scripts/python.exe -B scripts/configure.py --check
npm.cmd --prefix apps/web run typecheck
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run build
```

Use the current task reports for the actual recorded results and remaining gates. Backend integration tests require the separate loopback test database, never the hosted DSN. Do not run worker/browser/DB test harnesses simultaneously.

## 3. Confirm Supabase privately

Keep the existing project, private bucket and accounts. The canonical local configuration is root `.env.local`; never upload it to Cloudflare, Git, an artifact archive or a model host. Only the explicit server settings below belong in the API host's private environment.

1. Confirm the dashboard project is on Free with no paid add-ons. Note its actual project URL and pooler connection; do not invent a hostname.
2. `DATABASE_URL` must be the actual PostgreSQL shared **session pooler** URI when IPv4 connectivity is required. URL-encode special characters in its password. The production API requires TLS. Do not buy an IPv4 add-on.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. The browser receives only the publishable/anon key. The private `originals` bucket must remain private.
4. Confirm actual asymmetric signing settings. The API supports ES256/RS256 with `AUTH_ISSUER`, `AUTH_AUDIENCE=authenticated` and `AUTH_JWKS_URL`. A legacy symmetric key is not a usable public JWKS configuration.
5. Migration 006 is already applied to the configured project. Migrations 007/008 are verified locally and remain unapplied to the hosted project; applying them there needs separate approval. On another approved project only, run `.venv/Scripts/python.exe -B scripts/migrate.py`. This command applies every pending migration, so inspect the exact pending files first. It is checksum-tracked/idempotent and does not create Auth accounts. Never edit an applied historical migration or run test fixtures against this project.
6. Verify trusted applicant and assessor logins through [account setup](ACCOUNT_SETUP.md). Assign the assessor to the intended cohort. Do not promote an applicant automatically to make the queue visible.

## 4. Prepare the API artifact and settings

`infra/Dockerfile.api` installs the pinned lightweight API requirements and copies application code plus the attributed OSM regional snapshot. `.dockerignore` excludes private settings, datasets, model weights, caches, environments and unrelated repository files. `infra/render-free.yaml` selects Free and disables auto-deploy; it is not evidence of an actual service.

After publication/source-upload approval, create the intended Render web service from the approved sanitized source/revision. If using a Git connection, separately approve the repository publication/connection and check that it will not automatically publish unapproved branches. Choose the repository root as Docker context and `infra/Dockerfile.api` as Dockerfile. The container listens on Render's `PORT`; health path is `/health/live`.

Enter privately:

| Setting | Value/purpose |
|---|---|
| `APP_ENV` | `production` |
| `ALLOW_PAID_SERVICES` | `false` |
| `MODEL_RUNTIME` | `owned_worker` |
| `DATABASE_URL` | Verified Supabase TLS pooler URI |
| `SUPABASE_URL` | Actual Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server key |
| `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE` | Verified project JWT values |
| `PRIVATE_UPLOAD_BUCKET`, `STORAGE_BACKEND` | `originals`, `supabase` |
| `WORKER_CREDENTIAL` | Matching worker bootstrap secret, not a public key |
| `STAGE_CAPABILITY_SIGNING_KEY` | API-only signing secret; never copy to worker/frontend |
| `PUBLIC_WEB_URL` | Intended actual `https://…pages.dev` or approved custom frontend origin |
| `CORS_ORIGINS` | JSON list containing that exact HTTPS origin, no `*` |
| `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX` | Small pool, e.g. `1`, `3` |
| `GROQ_ENABLED`, `GROQ_API_KEY`, `GROQ_MODEL` | Optional free-plan explanation settings; default model `openai/gpt-oss-120b` |
| `OSM_OVERPASS_URL` | Default `https://overpass.private.coffee/api/interpreter` |
| `OSM_USER_AGENT` | Distinct application identifier, ideally including the approved operator contact/project URL |
| `ENABLE_PUBLIC_NOMINATIM` | Keep `false` unless the developer explicitly opts in under its policy |

Never use `STORAGE_BACKEND=local` in production; the settings reject it. Do not copy Vite variables, private local test DSNs or an entire root env file into the API container. `TEXT_DOCUMENT_SPACE_URL` and `SPEECH_TRANSLATION_SPACE_URL` are not required for this owned-worker configuration.

Once the approved API is deployed, record its actual HTTPS origin. Check `/health/live` and `/health/workspace`. The stricter `/health/ready` does not certify unverified storage/models and can still return 503; do not point the platform liveness probe at an intentionally unverified quality gate.

## 5. Build the frontend for the actual origins

Set only public build-time values, using the actual deployed API/Supabase URLs. These are process-scoped example placeholders, not secret values:

```powershell
$env:VITE_API_BASE_URL='https://YOUR-ACTUAL-API-ORIGIN'
$env:VITE_SUPABASE_URL='https://YOUR-ACTUAL-PROJECT.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='YOUR-PUBLIC-PUBLISHABLE-KEY'
npm.cmd --prefix apps/web run build
```

Build from the approved source. **Never set a database, worker, HF, Groq or service-role secret with a `VITE_` prefix.** Vite exposes only that prefix, and changing a build-time URL/key requires rebuilding.

Review `apps/web/dist` before approval/publication. It includes SPA fallback `_redirects`, the early external `theme.js`, and generated `_headers` with CSP connections restricted to the exact public API/Auth origins used at build time. Keep microphone permissions for same-origin recording. No original files, model weights or root env file belongs here.

## 6. Publish only the approved frontend build

After explicit publication approval, use Cloudflare Pages Direct Upload for **only** `apps/web/dist`, or the separately approved Git integration with root `apps/web`, build `npm run build` and output `dist`. Direct Upload still publishes a website even without a Git push and needs approval. Record the actual Pages project/domain and deployed version.

Update API `PUBLIC_WEB_URL` and exact `CORS_ORIGINS` if the final domain differs. Configure the matching approved site/redirect origins in Supabase Auth. Rebuild the frontend if the API origin changed. Do not enable permissive wildcard CORS as a shortcut.

## 7. Start the owned laptop worker

The laptop needs the existing model environment, pinned selected snapshots and network access to the approved API. The worker receives only API URL, worker ID/credential and an optional download token. It never needs database/service/signing/Groq keys. A separately hosted worker may use a narrow ignored worker-only file; local API/frontend/launcher settings stay in the one root `.env.local`.

For a remote API, set a narrow private environment and run from the checkout:

```powershell
# Set WORKER_CREDENTIAL privately in the process/worker-only environment, never in arguments.
.venv-model/Scripts/python.exe -B -m app.worker --api https://YOUR-ACTUAL-API-ORIGIN --worker-id owned-laptop --handler app.pipeline.run:handler --stages extract:text extract:pdf extract:audio translate structure assess --continuous --stage-seconds 600
```

Use `start.cmd` for the entirely local configuration. Remote HTTPS does not need `--allow-loopback`. Keep the laptop awake while judging and stop the operator worker normally when finished. Model concurrency is one on this laptop; accepted jobs remain durable while it is offline. This is genuine work polling, not an artificial GPU/host keep-alive or quota bypass.

## 8. Perform deployed acceptance before claiming a live demo

Use approved scoped accounts/data. Record the real URL/version, cold start, queue wait and processing time separately:

1. Sign in as an applicant, submit an English idea, inspect original/English evidence and reload its saved result.
2. Upload a digital PDF, download the original through authorized access and compare its bytes. Test a scan only with its actual source-review/quality limits visible.
3. Exercise a supported regional recording, verify transcription/English facts against the original, and show coarse chunk timestamps. Odia requires explicit language selection and its separate pinned model. Do not claim validated accuracy from its short smoke check.
4. Request a Groq explanation using the configured free key; check English/Hindi output, citations, cached reload and quota/error fallback. Scores must remain unchanged.
5. Run a confirmed-area OSM lookup. Show source/date/radius, empty/timeout states and the explicitly dated geofenced fallback. Nominatim must remain disabled unless separately enabled under policy.
6. Open the cohort assessor queue, record a reasoned decision, answer a clarification, inspect a corrected revision and verify stale edits are rejected. Confirm another applicant/cohort cannot read its evidence, context, report, similarity or aggregates.
7. Open all four comparison views, including small/empty groups, missing scores and synthetic exclusions. Export the selected version and inspect its multipage PDF.
8. Stop the owned worker during a scoped job; confirm waiting/checkpoint state and recovery after restart, without duplicate result publication. Restart the API and confirm persistence. Do not kill unrelated user processes/jobs.

Only mark T24/T25 done after these real checks. Local mocks, successful builds and downloaded models do not substitute for them. Do not run scale/load tests against free public providers or the real Supabase project.

## 9. Recovery and troubleshooting

| Symptom | Action |
|---|---|
| Password login succeeds but workspace denied | Check trusted profile/cohort/role, API connection and supported JWT signing settings; do not add a login bypass |
| API cold start / temporary 503 | Wait for the free service to wake, check workspace DB status/log error type, then retry; preserve accepted submissions |
| Pooler DNS/TLS/auth failure | Verify actual project/session-pooler URI, encoded password, project state and network; never print DSN or substitute a guessed hostname |
| Queue waiting for worker | Start the authenticated owned worker with the same manifest/credential and supported stage list |
| `model_access_denied` | Check pinned cached files and language support. Downloads are explicit; no paid/hosted fallback. Odia needs its separately provisioned weights and explicit language selection |
| Slow/failed scan | Keep page checkpoints/original. Native OCR uses generation cache; output/truncation and handwriting uncertainty still need human review. Resume compatible checkpoints or submit a corrected transcript as a new revision |
| Source-review headline withheld | Inspect the original; a trusted assessor can verify/correct the full transcript and queue reassessment. More text alone does not certify an earlier scan |
| Groq unavailable/429 | Keep the saved rule-based explanation, wait for the free quota, verify account/model permissions privately. Never upgrade automatically |
| OSM unavailable/empty | Retain the assessment and source coverage note; use the labelled matching-area dated snapshot when applicable. Do not infer no competition |
| Stale version / manifest conflict | Refresh expected revision. Preserve older results/originals; do not relabel old model output as a new manifest. Use a new input revision for incompatible processing |
| Browser calls wrong API or CSP blocks it | Rebuild with exact public origins and republish only after approval; do not weaken CSP/CORS globally |

## 10. Rollback and handover

Keep the previous approved frontend/API deployment versions and local Git revision. Roll back application artifacts through the provider's supported controls; confirm compatible API/contracts before mixing versions. Do not drop additive Supabase tables or rewrite historical migrations as rollback. Preserve originals, immutable assessments, audit/review actions and pending jobs. Credential rotation requires matching server/worker updates; do it privately and verify access afterward.

Record deployment URLs/version IDs, actual Free plans/quotas, model revisions/licenses, worker startup, verification results and remaining limitations in SESSION_HANDOFF.md and the task reports. Current missing hosted acceptance, language ground truth, secondary HF/scale evidence and unapproved publication remain explicit. The system supports initial assessment; authorized people make final program/funding decisions.
