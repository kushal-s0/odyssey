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

Apply migrations and create your Supabase account/profile once using [setup details](docs/SETUP.md). Open **http://127.0.0.1:5173** and sign in through Supabase. API, frontend and text worker run together; Ctrl+C stops them. `start.cmd --preview` shows the landing page without inference.

English text assessments run locally; PDF/audio uploads work but their processing and regional translation remain incomplete. Nothing is publicly deployed. [Setup details](docs/SETUP.md) | [Current plan](planning/HACKATHON_RESET.md) | [Code explanations](explanations/README.md)
