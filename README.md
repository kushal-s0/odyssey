# Udyam Saathi

Evidence-linked first-level business idea screening. Implementation is in progress; use [task status](planning/TASK_STATUS.md) for real capability and verification status. No deployment is claimed.

## Local development

Use Python 3.11, Node 22 and npm. Create a project virtual environment, install the pinned API development lock, then start the API from the repository root:

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe -r apps/api/requirements-dev.lock
.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd apps/web
npm ci
npm run dev
```

Set optional public frontend configuration in `apps/web/.env.local`; private API/model configuration belongs in ignored root `.env.local` and deployment secrets. See `.env.example`. `/health/live` checks the process; `/health/ready` must not claim unverified persistence/model readiness. Production startup rejects missing required configuration. The API image excludes model frameworks/weights and source archives.

## Checks and guides

```powershell
.venv/Scripts/python.exe -m pytest -c apps/api/pyproject.toml
cd apps/web
npm run build
```

Read [explanations](explanations/README.md), [source/license records](docs/SOURCES.md), [free feasibility](docs/FREE_FEASIBILITY.md) and [session handoff](planning/SESSION_HANDOFF.md). T27 will provide the detailed final deployment walkthrough. Keep original source material private. No Git push/publication is authorized by local implementation or commit permission.
