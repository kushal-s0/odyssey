# Setup for the current hackathon build

The normal demo uses **one Supabase project** for PostgreSQL, login and private originals, plus the React frontend, Python API and a laptop GPU worker. A separate local PostgreSQL/Docker installation is optional test infrastructure, not required for this configuration.

## Requirements

Python 3.11, Node 22/npm and `uv`. The owned model environment needs a compatible NVIDIA driver. This machine currently has an RTX 5050 Laptop GPU with 8151 MiB reported VRAM. The teammate's RTX 3050 benchmarks remain measurements from that other computer.

Two Python environments are retained because the API is small while the GPU worker needs several gigabytes of PyTorch/model libraries. `.venv` and `.venv-model` are dependency folders, not services or databases. `.env.local` files are configuration text, not environments you activate. `.cache`, `.mypy_cache`, `.ruff_cache` and `.local` are caches/test artifacts.

## One local configuration file

The API and local Vite frontend now read **root `.env.local`**. Run `.venv/Scripts/python.exe -B scripts/configure.py` once; it preserves/migrates the old browser settings and generates the two worker secrets locally. It never prints secret values. `--check` lists only missing names.

Two values must be supplied privately for the Supabase-only application:

| Setting | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase dashboard > Connect > PostgreSQL shared session-pooler connection string; replace its database password placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys > legacy service_role key; server only |

The existing public Supabase URL/publishable key are reused and the standard issuer/JWKS URLs derived. Verify the project uses a supported asymmetric signing key. `VITE_` settings are public browser configuration; database/service/worker/HF credentials never receive that prefix. An existing HF read token is retained privately, but no token or paid API is needed for the cached public English models.

The user explicitly chose Supabase login only. There is no demo authentication bypass. Create password judging accounts and trusted profiles/cohort assignments using [account setup](ACCOUNT_SETUP.md). A public key alone cannot perform backend storage/database operations or provision profiles. Applying `.venv/Scripts/python.exe -B scripts/migrate.py` modifies the privately configured project; local tests always use a separate loopback DSN.

After setup/configuration, run **`start.cmd`** from the repository root. It starts the real API, frontend and owned text worker together. Open http://127.0.0.1:5173 and sign in with your Supabase account. Ctrl+C stops only its own child processes. `start.cmd --preview` starts the landing/API preview without a worker; this does not create assessments. Logs are ignored under `.local/run-logs`.

## GPU worker

Qwen and pinned MiniLM weights are now cached on this laptop. The missing model packages have been installed. Actual inference results are recorded in the current handoff. Do not reinstall/download the already working CUDA packages unnecessarily.

```powershell
uv pip install --python .venv-model/Scripts/python.exe -r apps/api/requirements.lock -r models/requirements-text.txt
uv pip install --python .venv-model/Scripts/python.exe --no-deps -e apps/api
# Reuses verified existing Qwen files and provisions missing pinned embedding weights:
.venv-model/Scripts/python.exe -B scripts/download_models.py --artifacts qwen embedding
```

This laptop now has the pinned NumPy 2.2.6 and the missing runtime packages installed. Verify dependencies after transferring the repository; Git does not transfer environments. The separate Windows CUDA lock is historical and is not the API deployment lock.

For a separately deployed worker only (the local launcher supplies these values from the root file):

```powershell
if (!(Test-Path .env.worker.local)) { Copy-Item apps/api/worker.env.example .env.worker.local }
```

Set `WORKER_API_URL=http://127.0.0.1:8000`, `WORKER_ID=owned-laptop`, the matching `WORKER_CREDENTIAL` and optional `HF_TOKEN`. Keep database/service-role/signing keys out of this worker file. With the API up and provisioning complete:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --allow-loopback --handler app.pipeline.run:handler --stages extract:text translate structure assess --session-seconds 3600 --idle-seconds 300 --stage-seconds 240
```

This advertises implemented text stages. It does not implement PDF/audio handlers. The standalone command above uses a finite session. The local start.cmd launcher explicitly runs the owned worker continuously until Ctrl+C, so there is no artificial idle/session expiry. Per-stage timeouts and concurrency-one limits still apply; the computer and network must remain available. The current API readiness endpoint also still returns 503 unconditionally for unverified storage/models, so liveness alone must not be presented as inference readiness.

The two AI4Bharat config probes still returned HTTP 401 using the already configured token on this machine during the audit. Do not make the demo depend on those gates silently resolving. A verified accessible local alternative or explicit configured access must supply translation/speech before those features are claimed.

## Developer checks, not normal user startup

API checks: `.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api -q`; lint/type checks use the same environment. The suite uses ignored `.local/test-database-url`, requires a loopback test database for integration cases, and never targets your hosted Supabase project. A skipped test is not passed integration evidence.

Frontend: `npm.cmd --prefix apps/web run typecheck`, `npm.cmd --prefix apps/web run lint`, `npm.cmd --prefix apps/web run build`. The browser/model verification harness uses temporary synthetic identities and needs the local test database and configured model dependencies; it is not the command a new user should run to start the app.

Current implementation priorities are in [the audit](../planning/HACKATHON_RESET.md). Old setup versions remain available in Git history.
