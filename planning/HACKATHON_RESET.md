# Hackathon reset: current code audit and repair order

Updated 2026-10-17 21:39 IST. Latest user direction: solve the problem statement quickly; this is a hackathon build, not a production-readiness program. This file takes priority over the older sequential release gates. Deadline remains 18 October, 06:00 IST. No paid APIs or publication without approval.

## What the organizer actually asks for

I reread the supplied three-page Tata STRIVE PDF in the original source directory. The required journey is: accept text/audio/PDF in Indian regional languages; identify language and translate to English while keeping originals; extract the business, customers, location and economics; give reasoned initial ratings/strengths/gaps/risks; retrieve similar submitted ideas; provide sourced nearby-business context; and show domain/trade/cohort/across-cohort comparisons in a consolidated assessor view. It prefers real-time behavior. It does not require our own foundation model, two HF deployments, a bespoke logistic classifier, multiple database engines, elaborate recovery infrastructure or a production certification.

Keep those functional requirements. Defer extra release machinery rather than silently dropping the brief's PDF/audio/language/context/comparison requirements.

## Actual feature state, from code and checked-in evidence

| Brief requirement | Existing implementation | Remaining work |
|---|---|---|
| Text input | API and applicant form, saved status, local worker path | Restore this laptop and fix longer-input reliability |
| PDF input | Real private upload/type/page validation and intact originals | Digital-PDF extraction, scanned handwriting processing and source pages |
| Audio input | Real recording/upload/playback and validated originals | Actual speech-to-text and honest time references |
| Regional-language understanding | Detector and translation adapter; English passthrough | Non-English translation is blocked and not serving; speech languages not verified |
| Business facts and evidence | Typed grounded extraction; server persistence | Improve coverage and avoid rejecting whole otherwise useful batches |
| Reasoned ratings | Six domains plus separate completeness, deterministic totals and evidence | Validate realistic varied inputs; model output quality remains unreviewed |
| Consolidated assessor view | Applicant assessment component can be reused | An assessor role currently falls back to the landing page; queue/workspace absent |
| Similar ideas | MiniLM provider exists for advisory relevance | No similar-submission endpoint/retrieval/view |
| Nearby business context | Planned only | Sourced lookup/snapshot and UI; no fabricated competitors |
| Four comparison views | Schema/rubric groundwork only | Domain/trade/cohort/across-cohort queries and charts |
| Clarification/review/export | Contracts and some database tables | Actual flows/routes/UI/report |
| Deployed demo | Build/service files only | Real configured services, worker, HTTPS URL and journey checks |

The previous four-done-of-29 counter counts the original engineering backlog; it is not a meaningful product-completion percentage. We must report actual features separately. Historical reports remain evidence of the environment where they ran, not this machine's current readiness.

## Why this checkout feels broken

1. **Machine mismatch.** Handoff/prompt mention Kushal's path, native PostgreSQL and RTX 3050. Current workspace is Kartik's desktop, branch `second`, actual GPU RTX 5050 Laptop/8151 MiB. Existing history is preserved; new commits use Kartik as explicitly reconfirmed.
2. **Incomplete backend configuration.** Root API database/Auth/storage/worker settings are blank. Frontend has a Supabase URL/public publishable key, but those do not configure the Python API or create profiles. No worker settings file exists here. Actual hosted integration is therefore unverified.
3. **Model environment did not travel with Git.** Existing Qwen snapshot is present, but MiniLM weights are missing. Current model environment lacks `pydantic`, `httpx`, `py3langid`, `sentencepiece`; NumPy is 1.26.4 versus the new recipe's 2.2.6. GPU PyTorch/Transformers already exist and should be reused.
4. **Startup instructions omitted package installation.** Installing requirements alone did not install `app`. `.venv/.../python -m app.worker --help` failed with ModuleNotFoundError. Installed this repository as an editable package into the existing API environment without changing runtime dependency versions; CLI and 16 focused worker tests now pass. Model environment still needs its own correct setup.
5. **Schema lag after pull.** Local test DB had four tracked migrations; current code requires five. Applied and replayed only missing additive migration 005 against loopback. No hosted database was touched.
6. **Misleading readiness/UX.** `/health/ready` currently always returns 503 for unverified storage/models. API liveness does not show a functioning inference pipeline. The PDF form said ten pages while the API permits twenty; corrected that label. The pending microphone-permission/old-file submission race remains in T08.
7. **Gated models remain inaccessible.** Current read-only config probes for IndicTrans2 and IndicConformer returned HTTP 401 using the existing token read in memory. No token was displayed/copied. A valid accessible alternative or resolved access must supply these capabilities; do not block the rest of the demo on them.
8. **Too much infrastructure before the product.** Leases, fencing, recovery, dual runtime packaging and a small classifier experiment received attention before the main assessor workflow and modalities. Preserve useful code rather than rewrite it, but stop adding more platforms and release gates before demonstrating the brief.
9. **Docs disagree.** Some guides say model handlers do not exist, others report working English inference; the handoff is stale. Replaced README with a short preview/start/progress page, moved full setup to docs/SETUP.md and retained the old README as historical reference. Entry-point plans now explicitly defer to this reset.

## Environments and databases, plainly

- `.venv`: small API/test Python dependencies, about 0.21 GiB logical file size here.
- `.venv-model`: GPU/model Python dependencies, about 4.48 GiB. Keeping two dependency sets is useful; running two database engines is not required.
- `.env.local`, `apps/web/.env.local`, optional `.env.worker.local`: private text configuration for server/browser/worker, not Python environments. Worker separation prevents handing database/service credentials to model code. We can automate local setup without adding new environments.
- `.cache`: downloads and model/package cache, about 8.63 GiB logical files; not another running environment. `.mypy_cache`/`.ruff_cache` are checker caches. `.local` includes test runs and old clean-install verification copies, not runtime prerequisites. `.tools` is a legacy tracked vendor directory. No directory was deleted during the audit.
- **Supabase supplies the application's PostgreSQL database.** [Official database overview](https://supabase.com/docs/guides/database/overview). The local PostgreSQL instance only exercises tests safely without touching hosted data. A Supabase-backed user does not need Docker/local PG. MySQL/MongoDB are not used; adding or migrating to them now would require persistence/Auth/worker changes with no brief benefit.
- Keep React + FastAPI + Supabase + owned open-weight inference. Python is already used for the models. Switching to Express/MongoDB tonight would discard working pieces; installing those tools earlier does not make a rewrite faster.

## New demo order

1. **One working flow on THIS laptop.** Complete reproducible model dependencies/cache and startup, preserve existing keys, connect the intended Supabase project when private settings are supplied, and demonstrate a real English/Hindi proposal through stored evidence and assessment. Fix the microphone race and text-repair behavior that blocks this flow. Make ordinary startup simple.
2. **The missing input/translation capabilities.** Digital PDF first, then actual scan/handwriting and audio transcription. Use measured accessible free models rather than unverified gated assumptions. Process one GPU stage at a time. Other-language results remain marked unvalidated until checked; do not call an upload a processed assessment.
3. **Build the assessor product.** Queue, consolidated original/English assessment, corrections/outcome, similar submitted ideas and reliable location context. Reuse the existing API contracts, assessment component and MiniLM instead of adding a new stack.
4. **Finish the brief's comparisons.** Domain/trade/cohort/across-cohort views with visible missing-data counts. Add concise clarification/arithmetic/report features after the core view, reusing existing typed fields.
5. **Deploy the actual demo early.** Keep chosen free application hosting and laptop inference; prepare exact artifacts for approval, verify the real hosted journey and provide a short deployment guide. Do not wait for secondary HF Spaces or a 10k-record scale study before making the demo reviewable.

Basic privacy, bounded files, real model evidence, correct arithmetic and honest limitations stay. Two HF deployments, large load tests, further classifier training and production operations documentation are deferred until after the core demo. The existing rejected classifier experiment is not a reason to train another one tonight. Do not mark deferred tasks done.

## Audit checks

- Frontend TypeScript, lint and production build: PASS on this machine (1630 modules, about 458 kB uncompressed JS).
- Backend lint: PASS. Strict mypy: PASS, 53 source files.
- First full backend run: 122 passed, then worker process failed due missing editable package setup.
- Installed only the local API package; worker CLI and focused process/service/transport tests: 16 passed.
- Full post-repair regression: **138 passed, no skips, in 86.71 seconds**. Existing AnyIO/Starlette deprecation remains.
- Full English GPU inference and hosted Supabase/browser login have NOT been rerun on this checkout. Original dataset files and secret values were not changed. No publication or paid service.

## Immediate next implementation action

Restore the existing model environment minimally, provision missing MiniLM, then run `scripts/verify_owned_text.py --case english --with-assessment` here. In parallel only when safe, finish the small T08 microphone fix and reuse AssessmentView in a real assessor workspace. Do not start another infrastructure project or claim the app complete from the build/test results.

## Latest execution order requested by user

1. Cleanup: unused tracked .tools vendor copies, old clean-install copies and duplicate setup documents removed; originals/models/history retained.
2. Startup/secrets: one canonical root .env.local, preserved public settings/HF token, locally generated worker secrets, one start.cmd. Supabase login ONLY, explicitly selected by the user; no local demo bypass.
3. Results: existing GPU packages reused, missing dependencies/MiniLM installed, real English model check running. Do inference first: additional training is not required to display pretrained model results.
4. Training/data: the existing tiny rejected relevance experiment remains experimental. Use accessible pretrained models now; train only with relevant reviewed labels and a measured benefit. NLLB/Whisper are candidates, not integrated capabilities. Keep licenses/source attribution.
5. Complete the brief's input modalities and assessor/similarity/context/comparison features next. Deployment remains free and requires separate publication approval.

## Latest implementation checkpoint, 22:22 IST

The audit findings above describe the starting checkout. Cleanup and restoration
have now been implemented: one root private config, verified setup/start scripts,
Qwen/MiniLM dependencies/cache restored, actual English assessment and ten browser
journeys passed, microphone race fixed, extracted business facts visible. T08 is
done. See SESSION_HANDOFF.md for current measurements and specific Supabase blockers.
The service key is missing and the configured DB hostname failed DNS; no hosted
integration is claimed. Next implement actual PDF/audio/translation and assessor
requirements, with continued safe grounding improvements.
