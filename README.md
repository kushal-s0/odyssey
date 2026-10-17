# Udyam Saathi

Evidence-linked first-level screening of business ideas submitted as text, documents or recordings. The intended workflow preserves original evidence, structures business facts, explains ratings and supports assessor review.

**Implementation is in progress. There is no deployed application or complete submission-to-assessment flow yet.** The frontend preview, authenticated API foundation, private uploads and outbound worker orchestration work locally. Model handlers and live hosted checks remain unfinished.

## See progress and continue development

| Resource | What to read |
|---|---|
| [Task tracker](planning/TASK_STATUS.md) | Live status of all 29 tasks and precise blockers |
| [Task reports](planning/task-reports/) | What actually passed, what remains unverified |
| [Session handoff](planning/SESSION_HANDOFF.md) | Current code state and exact next action |
| [Paste-ready continuation prompt](planning/NEXT_AGENT_PROMPT.md) | Paste this file's text into the next agent in this same workspace |
| [Code/functionality explanations](explanations/README.md) | Module guides, design decisions and limitations |
| [Committee questions](explanations/COMMITTEE_QUESTIONS.md) | Evidence-backed answers for judging |
| [Implementation tasks](planning/IMPLEMENTATION_TASKS.md) | Full backlog and acceptance criteria |

Current checkpoint: T02/T03 done; T01/T04/T05/T06 have verified local capabilities but external checks remain blocked. **T07's local runtime is verified**: restricted worker HTTP, native sessions, durable checkpoint recovery after process termination/API restart, scoped job controls and a bounded Gradio adapter are implemented. Live HF enqueue/auth/quota remain blocked; simulated Gradio responses are not live integration. The browser is still a workspace preview. See [worker operations](docs/WORKER_OPERATIONS.md) and the tracker for remaining tasks.

## Requirements

| Requirement | Purpose |
|---|---|
| Python **3.11** (tested 3.11.9) | API, scripts and tests; use a virtual environment |
| Node.js **22** and npm (tested 22.21.0 / 10.9.4) | React/Vite frontend |
| Git | Local version history |
| Docker Desktop with the Linux engine/WSL2 | Optional local PostgreSQL/pgvector integration tests |
| Network access for dependency/model downloads | Initial setup; model caches can be reused afterward |
| Supabase **Free** project | Real hosted Auth, database and private object storage; not required just to view the frontend |
| Hugging Face account and **read** token | Gated model downloads after accepting each model's access conditions |
| NVIDIA laptop for the planned owned worker | Observed RTX 5050 Laptop with about 8 GB VRAM and 24 GB system RAM; use one model stage at a time |
| Cloudflare Pages Free / Render Free accounts | Final static frontend/lightweight API hosting; no project is deployed yet |

The tested local model environment uses PyTorch 2.9.1+cu128, torchvision 0.24.1+cu128 and transformers 4.57.6, separate from the API. A supported NVIDIA driver is required; installing a standalone CUDA toolkit is not normally necessary for the pinned PyTorch wheel. Model fit/quality varies by stage: only the CUDA and bounded Qwen feasibility checks have run. Do not assume all models fit in VRAM together. See [actual feasibility evidence](docs/FREE_FEASIBILITY.md).

No OpenAI key, paid inference API, paid maps key, paid hosting plan or trial-credit dependency is required. Free cloud services retain quotas/sleep behavior; laptop inference requires power, internet and the worker process. Never promise unlimited hosting or throughput.

## 1. Prepare the API environment

Open PowerShell in the repository root. Reuse an existing `.venv`; do not delete/recreate a working environment unnecessarily.

```powershell
# Run only if .venv does not exist:
py -3.11 -m venv .venv

# Install exact API/development dependencies:
.venv/Scripts/python.exe -m pip install -r apps/api/requirements-dev.lock
```

If Python's launcher is unavailable, use your Python 3.11 executable in place of `py -3.11`. If you already use `uv`, the equivalent dependency command is:

```powershell
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache/uv'
uv --system-certs pip install --python .venv/Scripts/python.exe -r apps/api/requirements-dev.lock
```

Do not disable certificate verification to resolve a network/certificate issue.

## 2. Prepare configuration without overwriting values

Ignored placeholder files are prepared in this workspace. On a fresh private checkout, copy templates only when the destination is absent:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
```

Fill values privately when ready. Never send secrets in chat, commit them, paste them into the README or place server secrets in any `VITE_` variable. Empty service settings allow a development preview; they do not establish a working backend integration.

### Root `.env.local`: API/model settings

| Variable | Required for / where to obtain it |
|---|---|
| `APP_ENV` | `development` locally; `production` only with complete deployment configuration |
| `PUBLIC_WEB_URL` | Frontend origin, locally `http://127.0.0.1:5173`; final HTTPS origin after deployment |
| `CORS_ORIGINS` | JSON list of exact allowed frontend origins, e.g. `["http://localhost:5173","http://127.0.0.1:5173"]` |
| `DATABASE_URL` | Supabase dashboard **Connect**, shared **session pooler** PostgreSQL connection string; use its exact host/user/password, not a guessed hostname. Local testing has a separate ignored DSN below |
| `SUPABASE_URL` | Project URL, normally `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Public project publishable key; not a service/secret key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged project key for private storage. Obtain from project API-key settings; never expose to browser/model code |
| `AUTH_ISSUER` | Exact Auth issuer, normally `https://PROJECT_REF.supabase.co/auth/v1` |
| `AUTH_AUDIENCE` | `authenticated` |
| `AUTH_JWKS_URL` | Normally `https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json`; confirm the project actually uses an RS256/ES256 asymmetric signing key |
| `PRIVATE_UPLOAD_BUCKET` | `originals`; migrations create/configure it as private |
| `STORAGE_BACKEND` | `supabase` normally. Explicit `local` is development/test only; production rejects it |
| `MODEL_RUNTIME` | `owned_worker` preferred; `hf_zerogpu` is a separate quota-limited deployment target still to verify |
| `WORKER_CREDENTIAL` | Random private credential of at least 32 characters for restricted worker claims; same value in worker-only configuration |
| `STAGE_CAPABILITY_SIGNING_KEY` | Separate random secret, at least 32 characters, for short-lived stage capabilities; do not reuse the worker credential |
| `HF_TOKEN` | Hugging Face read token; accept IndicConformer/IndicTrans2 access conditions using the same account |
| `TEXT_DOCUMENT_SPACE_URL`, `SPEECH_TRANSLATION_SPACE_URL` | Optional owned HTTPS `*.hf.space` origins, used only when explicitly selecting `hf_zerogpu`; live checks pending |
| `ALLOW_PAID_SERVICES` | Keep `false`; paid fallback is forbidden |
| `ENABLE_PUBLIC_NOMINATIM` | Keep `false`; public geocoding needs explicit policy-informed opt-in |

For each worker secret, run the following locally and copy the result privately into its own field. Run it separately for the two secrets:

```powershell
.venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

These random local secrets are not purchased API keys. The worker receives only restricted configuration, never database/service/signing keys. See [worker startup, stop and recovery](docs/WORKER_OPERATIONS.md). The synthetic probe proves orchestration; actual model-handler startup remains T09–T12/T23A. Existing `.env` is preserved; the API reads `.env.local` and the runner reads `.env.worker.local`.

### `apps/web/.env.local`: browser-public settings only

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The last two values come from the same Supabase project as the API. The browser also supports a legacy **anon** public key, but never a service-role key. Actual Auth signing must still use the supported asymmetric key setup. Restart Vite after changing configuration; rebuild static assets for deployed changes.

Kartik will supply credentials after implementation. Development should continue using local checks; missing hosted checks must remain recorded rather than repeatedly asking for credentials.

## 3. Start and view the current preview

Terminal 1, from the repository root:

```powershell
.venv/Scripts/python.exe -B -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```powershell
cd apps/web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. API documentation is **http://127.0.0.1:8000/docs** in development. `GET /health/live` should return 200. `GET /health/ready` currently returns 503 while storage/model readiness is unverified; this is expected and must not be described as a ready assessment pipeline.

With blank Auth configuration, **Sign in** explains that access is being set up. Real login requires Supabase configuration and trusted provisioned accounts. Text/file submission APIs exist, but their frontend workflow and model processing are unfinished. Do not expect a generated assessment from this checkpoint.

Stop each terminal with Ctrl+C. If Windows locks Rollup files during dependency installation, stop the owned Vite preview before retrying `npm ci`. Do not stop unrelated Node processes.

## 4. Optional local PostgreSQL checks

Docker Desktop must be running with the Linux engine. These commands prepare a private password/DSN without printing them, start only a loopback test database and apply migrations:

```powershell
.venv/Scripts/python.exe -B scripts/prepare_local_db.py
docker compose --env-file .local/postgres.env -f infra/compose.test.yaml up -d --wait
.venv/Scripts/python.exe -B scripts/migrate.py --local
```

The database uses port **55432**, container `infra-postgres-1` and durable named volume `infra_udyam-test-pg`. The password is in ignored `.local/postgres.env`; the test URL is in ignored `.local/test-database-url`. Do not share either file. Keep the volume to preserve local database state.

This migrated workspace currently uses portable PostgreSQL **16.15** with locally
built pgvector **0.8.1**, bound to `127.0.0.1:55432`, because Docker is absent.
Its private data/binaries are under ignored `.local/native-postgres*`. This is
local test infrastructure, not a Supabase deployment or a portable release
artifact. Do not start Docker on the same port while it runs. The handoff records
the current native start/stop commands and build caveats.

To run the API against that database with explicit local private disk storage, set these only in its PowerShell terminal before the startup command:

```powershell
$env:DATABASE_URL = (Get-Content .local/test-database-url -Raw).Trim()
$env:STORAGE_BACKEND = 'local'
```

The test database contains minimal Auth/Storage schema shims for policy testing. It is **not** a local Supabase Auth server and does not itself provide password login. Use a real configured Supabase project for hosted Auth/Storage acceptance. Do not combine unrelated production Auth and test database projects for judging.

For a real Supabase project, fill root configuration, then run `.venv/Scripts/python.exe -B scripts/migrate.py` **without** `--local`. This modifies the configured project, so confirm privately that it is the intended project. No hosted migration was executed in this checkpoint.

## 5. Create real judging access when configuration is ready

Use the [trusted account setup and recovery guide](explanations/05-authentication-and-access.md). Create limited password accounts in Supabase Auth through trusted operator setup, disable public signup for judging, and assign existing account UUIDs to profiles/cohorts:

```powershell
.venv/Scripts/python.exe -B scripts/provision_access.py --user-id ACCOUNT_UUID --role applicant --cohort-id COHORT_UUID
# Repeat with the appropriate account/cohort; use --role assessor for assigned assessors.
```

The cohort must already exist. Do not use administrator accounts as ordinary judge/applicant logins. Share passwords privately. This avoids relying on last-minute email, SMS or magic-link delivery. Hosted login/refresh/recovery remain unverified until actually checked.

## 6. Verify local progress

From the repository root, with the local test database running:

```powershell
.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api -q
.venv/Scripts/python.exe -B -m ruff check apps/api/app tests/api
.venv/Scripts/python.exe -B -m mypy --config-file apps/api/pyproject.toml apps/api/app
```

The test fixture selects a fresh ignored workspace temporary directory. Database tests skip if the local DSN is absent; a skip is **not** a passed integration gate. The private-corpus test needs the preserved organizer archives and checks all 55 files without modifying them. It writes sanitized metadata only to `evals/reports/uploads-corpus.json`.

Frontend checks, from `apps/web`:

```powershell
npm run lint
npm run build
npm run test:smoke
```

The browser smoke check needs the preview running on port 5173 and an installed Microsoft Edge browser. `npm run test:auth` is a separate **synthetic HTTP-fixture** check requiring the setup documented in T05's report; it is not a real Supabase login test. API schema updates use root `scripts/export_openapi.py`, then frontend `npm run generate:types`.

Actual local results and limitations live in the [task reports](planning/task-reports/), including private-data handling and existing dependency warnings. CUDA/model probes use the separate `.venv-model`; do not install its Windows/CUDA lock into the API environment. See T01's report and the feasibility guide before rerunning a model download/inference.

Latest API regression: **110 passed, no skips** against the portable local
PostgreSQL database. The 24 focused worker checks include actual subprocess/HTTP
recovery and simulated Gradio transport. This does not establish model quality
or hosted service access. Historical model caches/`.venv-model` from the earlier
machine are absent here and must be verified/reprovisioned before model work.

## Deployment and operations still to finish

The selected zero-spend route is **Cloudflare Pages Free + Render Free + Supabase Free + the owned laptop worker**, with separately required versioned HF deployment checks. The laptop has no provider daily inference quota; its availability and the cloud free-plan limits still matter. No paid fallback is allowed.

T23/T23A prepare the final artifacts and worker startup. T24/T25 establish actual deployed HTTPS behavior/recovery. **T27 must finish `docs/DEPLOYMENT_GUIDE.md` with in-depth deployment steps** after the actual implementation is ready. These tasks are unfinished; this README is the current local-start/configuration guide, not evidence of deployment. See [deployment checklist](planning/DEPLOYMENT_CHECKLIST.md) for outstanding gates.

Original uploads, source archives, private configuration, caches and raw model outputs must remain private. Existing archives are already tracked: `.gitignore` does not remove historical tracked files. Prepare sanitized publication artifacts; never push this repository as a shortcut.

All new commits must be authored **and committed** only as Kartik Verma `<kartikverma2204number1@gmail.com>`, without co-authors, sign-offs or AI attribution trailers. Keep commits local. No push, pull request, remote source upload or deployment is authorized without Kartik's explicit publication approval. See [AGENTS.md](AGENTS.md) and [source/license records](docs/SOURCES.md).
