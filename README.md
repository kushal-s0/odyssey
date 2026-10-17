# Udyam Saathi

Tata STRIVE hackathon project: turn business ideas submitted as text, PDF or audio into a reasoned assessment, with original evidence, similar ideas and local business context.

**Current state:** partially implemented; not deployed. Short English text assessments were demonstrated on a teammate's machine. This checkout still needs its model environment and real Supabase connection completed. PDF/audio uploads exist; processing them is not implemented yet.

## Stack

React + TypeScript frontend, FastAPI backend, Supabase for database/login/private files, and open-weight models on the laptop GPU. **Supabase is the PostgreSQL database; you do not need a second local database to run that configuration.** MySQL, MongoDB, Docker and Hugging Face Spaces are not prerequisites for the selected demo path.

## Start the current frontend/API preview

Requirements: Python 3.11, Node 22 and `uv`. Run from the project root:

```powershell
# First setup only; reuse existing environments.
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe -r apps/api/requirements-dev.lock
uv pip install --python .venv/Scripts/python.exe --no-deps -e apps/api
npm --prefix apps/web ci
```

Skip `uv venv` if `.venv` already exists. Private configuration uses root `.env.local` and `apps/web/.env.local`; templates are provided. See [setup and configuration](docs/SETUP.md) for the required values.

```powershell
# Terminal 1, project root
.venv/Scripts/python.exe -B -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2, project root
npm --prefix apps/web run dev
```

Open **http://127.0.0.1:5173**. Blank backend settings show the landing page, not a working signed-in assessment. Model execution requires the separately configured GPU worker described in [setup](docs/SETUP.md).

## What works and what remains

| Capability | Current status |
|---|---|
| Applicant submission, private upload, recording UI | Implemented; final microphone-race fix pending |
| English text facts, evidence and reasoned scores | Implemented; longer-input reliability needs work |
| Regional translation, PDF/handwriting and audio processing | Incomplete |
| Assessor dashboard, similar ideas, location context, comparisons | Not implemented |
| Public deployment | Not deployed |

Read the [current audit and repair order](planning/HACKATHON_RESET.md), [code explanations](explanations/README.md), or [detailed task evidence](planning/TASK_STATUS.md). The demo is now prioritized over additional production infrastructure. No paid APIs. Keep original data and secrets private. Commits remain local under Kartik's name; no push or publication without approval.
