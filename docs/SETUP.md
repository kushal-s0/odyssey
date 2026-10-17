# Setup for the current hackathon build

The normal demo uses **one Supabase project** for PostgreSQL, login and private originals, plus the React frontend, Python API and a laptop GPU worker. A separate local PostgreSQL/Docker installation is optional test infrastructure, not required for this configuration.

## Requirements

Python 3.11, Node 22/npm and `uv`. The owned model environment needs a compatible NVIDIA driver. This machine currently has an RTX 5050 Laptop GPU with 8151 MiB reported VRAM. The teammate's RTX 3050 benchmarks remain measurements from that other computer.

Two Python environments are retained because the API is small while the GPU worker needs several gigabytes of PyTorch/model libraries. `.venv` and `.venv-model` are dependency folders, not services or databases. `.env.local` files are configuration text, not environments you activate. `.cache`, `.mypy_cache`, `.ruff_cache` and `.local` are caches/test artifacts.

## API and frontend

Use [README](../README.md) for the short startup commands. The editable package installation is required for commands such as `python -m app.worker` from the project root; installing only requirements does not install this repository's `app` package.

Do not overwrite existing configuration. When a file is absent:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
```

Configure root `.env.local` privately:

| Value | Purpose |
|---|---|
| `DATABASE_URL` | Connection string from the intended Supabase project's Connect dialog; shared session pooler if needed for IPv4 |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server key for original-file storage; never a browser variable |
| `AUTH_ISSUER` | Normally the project URL plus `/auth/v1` |
| `AUTH_JWKS_URL` | Normally the project URL plus `/auth/v1/.well-known/jwks.json`; current verifier needs an asymmetric RS256/ES256 project key |
| `WORKER_CREDENTIAL` | Random private worker credential, at least 32 characters |
| `STAGE_CAPABILITY_SIGNING_KEY` | A different random server signing secret, at least 32 characters |
| `HF_TOKEN` | Existing read token for explicit model provisioning, if needed |

Keep `MODEL_RUNTIME=owned_worker`, `STORAGE_BACKEND=supabase`, `ALLOW_PAID_SERVICES=false`. Other limits have defaults. `AUTH_AUDIENCE=authenticated`; local frontend origins are already allowed by default. No OpenAI, paid inference or paid maps API key is required.

Frontend `apps/web/.env.local` contains only the public settings used by the browser:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Only `VITE_` variables are exposed by Vite's normal client environment mechanism. This checkout also contains `HF_TOKEN` in the frontend configuration file; the backend/model provisioning commands do not read that file. It belongs in server/worker configuration when configured, not in a `VITE_` variable. No secret values are printed or copied by this audit.

After the real backend settings are filled, apply migrations to the intended Supabase project:

```powershell
.venv/Scripts/python.exe -B scripts/migrate.py
```

This changes that configured project. The audit only applied the missing fifth migration to the existing loopback test database; no hosted migration has been run. Create limited judging accounts and assign roles using [account setup](ACCOUNT_SETUP.md) and [trusted provisioning](../explanations/05-authentication-and-access.md). Do not assume frontend public configuration alone creates a backend or judging accounts.

## GPU worker: existing entry point, incomplete local dependencies

Qwen weights are already cached on this laptop. MiniLM weights and several packages used by the pulled pipeline are missing. **This section is the setup recipe, not a claim that inference has been restored here.** Do not reinstall/download the already working CUDA packages unnecessarily.

```powershell
uv pip install --python .venv-model/Scripts/python.exe -r apps/api/requirements.lock -r models/requirements-text.txt
uv pip install --python .venv-model/Scripts/python.exe --no-deps -e apps/api
# Reuses verified existing Qwen files and provisions missing pinned embedding weights:
.venv-model/Scripts/python.exe -B scripts/download_models.py --artifacts qwen embedding
```

The model requirements currently use NumPy 2.2.6; this laptop's older environment still has 1.26.4. Verify dependencies after provisioning rather than assuming the teammate's environment was transferred by Git. The separate Windows CUDA lock is historical and is not the API deployment lock.

If absent, create the worker settings file from its narrow template:

```powershell
if (!(Test-Path .env.worker.local)) { Copy-Item apps/api/worker.env.example .env.worker.local }
```

Set `WORKER_API_URL=http://127.0.0.1:8000`, `WORKER_ID=owned-laptop`, the matching `WORKER_CREDENTIAL` and optional `HF_TOKEN`. Keep database/service-role/signing keys out of this worker file. With the API up and provisioning complete:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --allow-loopback --handler app.pipeline.run:handler --stages extract:text translate structure assess --session-seconds 3600 --idle-seconds 300 --stage-seconds 240
```

This advertises implemented text stages. It does not implement PDF/audio handlers. The worker exits after its finite session or idle period; restart it for actual processing. The current API readiness endpoint also still returns 503 unconditionally for unverified storage/models, so liveness alone must not be presented as inference readiness.

The two AI4Bharat config probes still returned HTTP 401 using the already configured token on this machine during the audit. Do not make the demo depend on those gates silently resolving. A verified accessible local alternative or explicit configured access must supply translation/speech before those features are claimed.

## Developer checks, not normal user startup

API checks: `.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api -q`; lint/type checks use the same environment. The suite uses ignored `.local/test-database-url`, requires a loopback test database for integration cases, and never targets your hosted Supabase project. A skipped test is not passed integration evidence.

Frontend: `npm --prefix apps/web run typecheck`, `npm --prefix apps/web run lint`, `npm --prefix apps/web run build`. The browser/model verification harness uses temporary synthetic identities and needs the local test database and configured model dependencies; it is not the command a new user should run to start the app.

For historical diagnostics only, the [previous detailed setup](SETUP_REFERENCE.md) is retained. Current implementation priorities are in [the audit](../planning/HACKATHON_RESET.md).
