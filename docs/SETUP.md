# Run the current application

Use React/FastAPI with one Supabase project for database, login and private originals. The owned laptop runs the pretrained models. Local PostgreSQL/Docker is optional test infrastructure, not an application requirement.

## This checkout

The existing API/model environments and selected public model weights are provisioned. Supabase migration 006 was explicitly approved and applied on 18 October 2026; earlier migrations were left unchanged. Keep the filled root `.env.local` values private. Do not recreate accounts or replace keys just to start the app.

1. Add the optional `GROQ_API_KEY` in root `.env.local`. The other Groq settings are prepared; `GROQ_MODEL` defaults to `openai/gpt-oss-120b`. Use a free-plan project. Missing/limited Groq leaves saved results and the assessment guide available.
2. Run `start.cmd` from the repository root and open **http://127.0.0.1:5173**.
3. Sign in with your provisioned Supabase account. The role comes from the trusted profile/cohort, never a browser toggle. Applicants see My ideas; assessors see the review queue; admins can open both. Everyone's comparisons stay within their access.
4. After changing `.env.local`, stop the launcher with Ctrl+C and restart it. It stops only its own child processes. Logs remain ignored under `.local/run-logs`.

## Fresh-machine setup

Install Python 3.11, Node 22/npm, `uv`, and a driver compatible with the owned CUDA model environment. Run `setup.cmd`. It reuses existing environments/cache and explicitly provisions Qwen, MiniLM, Whisper, NLLB and PaddleOCR. Downloads require disk space and network; they do not upload source data. API `.venv` and GPU `.venv-model` are dependency folders, not extra databases.

Review [model provenance and licenses](../models/PROVENANCE.md): selected NLLB weights are **CC-BY-NC-4.0** for this noncommercial hackathon prototype, and the model card does not describe a production deployment. Do not call this a general commercial production configuration.

Configure the one ignored root `.env.local`:

| Names | Purpose |
|---|---|
| `DATABASE_URL` | Actual Supabase shared session-pooler PostgreSQL URI; password stays private |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server project URL and private storage/admin credential |
| `SUPABASE_PUBLISHABLE_KEY` | Public browser project key, not the service-role key |
| `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE` | Verified Supabase asymmetric JWT configuration |
| `WORKER_CREDENTIAL`, `STAGE_CAPABILITY_SIGNING_KEY` | Locally generated separate worker bootstrap/capability secrets |
| `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Only public browser settings |
| `GROQ_API_KEY`, `GROQ_ENABLED`, `GROQ_MODEL` | Optional server-side explanation provider |
| `OSM_OVERPASS_URL`, `OSM_NOMINATIM_URL`, `OSM_USER_AGENT`, `OSM_CACHE_HOURS` | Bounded map-provider configuration; standard public endpoints use no key |
| `ENABLE_PUBLIC_NOMINATIM` | Explicit developer opt-in; false by default |

`scripts/configure.py` preserves filled values, derives standard Auth/browser URLs and generates missing worker secrets. It prints missing **names**, never secret values. Supabase login is mandatory; there is no local/demo Auth bypass. Follow [account setup](ACCOUNT_SETUP.md) for trusted profile/cohort provisioning. Migrations modify the configured project; apply them only to the intended approved project. Tests never use its DSN.

## Use the product

Text/PDF/audio originals are stored privately before processing. The durable job moves through extraction, translation, structuring and assessment. The laptop processes one model stage at a time, with bounded 600-second stages and saved checkpoints. A saved upload is not a completed assessment; long scans can take minutes. Refresh status, resume a paused job, or return later.

The assessment separates business potential, evidence coverage and information completeness. Unknown facts remain unknown. Source buttons show original/English excerpts and their page, characters or coarse audio chunk times. Unreviewed OCR/ASR and unresolved source/language uncertainty withhold the headline/ranking. Regional quality is unvalidated beyond the recorded checks; Odia speech uses a separately pinned ARTPARK-IISc model with shorter chunks; select Odia explicitly. A 6.45-second smoke passed, but full-language accuracy remains unvalidated. The selected translation model covers Odia text.

Groq explanations are requested explicitly from a saved result, in English or Hindi. They use reduced business facts/ratings, not original files; they cannot change scores. Generated explanations are cached by assessment/model/language/policy, validate their schema/citations/numbers and still require evidence review. Use the rule-based guide when the provider is unavailable.

Location context requires confirming an approximate business area and radius. Standard OSM Overpass lookup does not require a key. Nominatim geocoding remains disabled until the developer deliberately accepts its [usage policy](https://operations.osmfoundation.org/policies/nominatim/); it is never autocomplete or bulk geocoding and uses an application-wide shared limit. Coordinates work while geocoding is disabled. The dated Bengaluru fallback is geofenced, attributed and explicitly labelled offline; other unavailable locations are not filled with unrelated listings.

The assessor can record next-step decisions, add corrections, or verify a complete transcript after checking the original. A complete replacement requires explicit source verification. Changes create new revisions and normal reassessment jobs; previous files/evidence/decisions remain. Source verification does not independently validate demand or other business claims.

Related ideas use pinned MiniLM vectors and database-scoped retrieval; no unauthorized applicant ideas are disclosed. New assessments are indexed automatically. To index older current results, run the bounded dry-run command first:

```powershell
.venv-model/Scripts/python.exe -B scripts/backfill_embeddings.py
# When the listed current-assessment count is expected:
.venv-model/Scripts/python.exe -B scripts/backfill_embeddings.py --apply
```

Comparisons provide dimensions, trades, cohorts and across-cohort/within-trade views with denominators and missing-data counts. Synthetic examples and repeated families are excluded by default. Financial checks preserve uncertainty and distinguish sales revenue from operating surplus. Version reports support isolated preview, HTML download and browser Print / save PDF.

## Worker on another host

Keep its environment narrow: API URL, worker ID/credential and optional model-download token. Never copy database/service/signing/Groq keys to a worker. After separately provisioning the same pinned models/package:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --api https://YOUR-API-HOST --handler app.pipeline.run:handler --stages extract:text extract:pdf extract:audio translate structure assess --continuous --stage-seconds 600
```

Use private environment variables for `WORKER_CREDENTIAL`; do not put it in command arguments. Local HTTP needs the explicit `--allow-loopback` flag. The computer/network must remain available; this is laptop-backed inference, not fully cloud-hosted or unlimited service.

## Verify and diagnose

```powershell
.venv/Scripts/python.exe -m pytest tests/api -q
.venv/Scripts/python.exe -m ruff check apps/api/app tests/api
.venv/Scripts/python.exe -m mypy --config-file apps/api/pyproject.toml apps/api/app
npm.cmd --prefix apps/web run typecheck
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run build
```

Integration tests use ignored `.local/test-database-url` and explicitly reject non-loopback DSNs. Run DB suites and model/browser harnesses sequentially because they share test admission/claims. A skipped test is not passed integration evidence. Actual browser fixtures are labelled; model/provider smoke reports are separate. See [status](../planning/TASK_STATUS.md), [handoff](../planning/SESSION_HANDOFF.md) and task reports for remaining acceptance gates.

If sign-in works but access is denied, check the trusted profile/cohort. For DB DNS/TLS issues use the actual session pooler and check project status. For `model_access_denied`, provision the pinned public artifact and check language support; do not enable a paid fallback. Queue waits usually need the owned worker, not another database. Preserve originals/checkpoints during recovery. `/health/workspace` checks database access; `/health/ready` intentionally does not certify unverified storage/model quality. Public hosting is covered in [the deployment walkthrough](DEPLOYMENT.md) and still requires explicit publication approval.

Current configured Groq provider has passed synthetic English/Hindi generation. Defaults remain gpt-oss-120b for new setup; a filled GROQ_MODEL is preserved (the current private setting selected gpt-oss-20b). Restart start.cmd after private setting changes. Full quality validation is separate from connectivity.
