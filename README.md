# Udyam Saathi

Business ideas: extracted facts, original evidence and reasoned assessments.
React + FastAPI + Supabase + free open-weight models on your NVIDIA laptop.

[Implementation and measured model results](docs/IMPLEMENTATION_AND_MODEL_EVALUATION.md) · [Excel results workbook](evals/reports/comprehensive/EVALUATION_WORKBOOK.xlsx) · [Searchable local report](evals/reports/comprehensive/IMPLEMENTATION_AND_MODEL_EVALUATION.html)

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

The app includes a guided idea builder, contextual missing/conflicting-field questions, a business map and downloadable brief, a separate what-if/break-even/stress planner, applicant/assessor workspaces, evidence-linked assessments, localized text/audio follow-ups, immutable history, related ideas, sourced OSM context, four comparisons with grouped bars/scatter/table/CSV, assessment radar and evidence confidence, financial checks, reports, private-source deletion and light/dark/system themes. Open **New idea → Guide me** to build an idea with questions, or select a saved idea and open **Business plan** to explore assumptions without changing its assessment. Add only `GROQ_API_KEY` for optional English/Hindi explanations; its other variables are prepared in root `.env.local`. Standard public OSM endpoints need no API key. [Positive/negative rehearsal inputs and answer keys](input/README.md) cover text, digital/scanned PDF and synthetic audio; select **Synthetic rehearsal input** before submitting them.

Real English assessments, typed/audio follow-up revisions, Hindi translation/ASR samples and OSM lookup have been measured. These checks do not establish population accuracy. Handwriting and regional-language quality still need human review; a private review screen covers all 55 supplied inputs. NLLB translation is licensed for noncommercial use—see [model provenance](models/PROVENANCE.md). Nothing is publicly deployed. [Setup](docs/SETUP.md) | [Deployment](docs/DEPLOYMENT.md) | [Evaluation](docs/EVALUATION.md) | [Status](planning/TASK_STATUS.md) | [Code explanations](explanations/README.md)
