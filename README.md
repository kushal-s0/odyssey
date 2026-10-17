# Udyam Saathi

Business ideas: extracted facts, original evidence and reasoned assessments.
React + FastAPI + Supabase + free open-weight models on your NVIDIA laptop.

## Setup once

Install Python 3.11, Node 22 and uv, then run:

```powershell
.\setup.cmd
```

Setup reuses existing environments/model downloads. All local settings live in **root `.env.local`**. Add `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase dashboard. For a fresh checkout, also fill SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Setup derives browser/Auth settings and generates worker secrets locally. Keep secrets private.

## Start

```powershell
.\start.cmd
```

Apply migrations and create your Supabase account/profile once using [account setup](docs/ACCOUNT_SETUP.md). Open **http://127.0.0.1:5173** and sign in through Supabase. An Auth account needs an application profile; creating only a login is insufficient. API, frontend and model worker run together; Ctrl+C stops them. Startup checks the database before printing the link. After changing `.env.local`, restart `start.cmd`. `start.cmd --preview` shows the landing page without inference.

The app includes applicant/assessor workspaces, evidence-linked assessments, follow-up revisions, related ideas, sourced OSM context, four comparisons, financial checks, reports and light/dark/system themes. Add only `GROQ_API_KEY` for optional English/Hindi explanations; its other variables are prepared in root `.env.local`. Standard public OSM endpoints need no API key.

Real English assessments, Hindi translation/ASR samples and OSM lookup have been measured. These are smoke checks, not a population-accuracy claim. Scan/language quality and release gates remain recorded in the tracker; A separate Odia speech model has passed a short local smoke check; full-language accuracy remains unvalidated. NLLB translation is licensed for noncommercial use—see [model provenance](models/PROVENANCE.md). Nothing is publicly deployed. [Setup](docs/SETUP.md) | [Deployment walkthrough](docs/DEPLOYMENT.md) | [Status](planning/TASK_STATUS.md) | [Code explanations](explanations/README.md)
