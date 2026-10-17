# Application foundation

## Structure and separation

`apps/web` is a static React/TypeScript frontend built by Vite. It does not contain model weights or private service credentials. `apps/api/app` is the FastAPI service. Slow model execution belongs in a separate worker environment, not the API image. The original archives, private mappings, local environment files and GPU environment are excluded from release contexts.

## Main code paths

- `config.py`: `Settings` parses typed environment configuration, hides input values in validation errors, bounds resource settings and rejects paid-service enablement. Production requires private persistence/auth/worker configuration and exact HTTPS browser origins. Secret fields use `SecretStr`; empty secret contents must not pass the configuration gate.
- `main.py`: `create_app()` supports isolated configuration for tests. Middleware assigns server-generated request IDs and logs only method/status/timing, avoiding source text, credentials and resource-path identifiers. Errors use a stable safe envelope. CORS permits only configured origins.
- `/health/live`: proves the API process responds. `/health/ready`: deliberately returns 503 until real dependency probes are implemented. Environment variables alone do not prove database/model readiness.
- `App.tsx`: the initial responsive workspace introduction and a bounded process-liveness check. It clearly says submission/assessment processing is not connected yet. A successful liveness response must not imply the entire processing system is ready.
- `styles.css`: warm neutral/green design, readable typography, responsive layout, skip link and keyboard focus. External font loading has local fallbacks; no beneficiary data is sent for fonts.

## Verification and tradeoffs

Meaningful bootstrap checks cover liveness versus readiness, missing/empty production secrets, disabled paid services, safe error envelopes and CORS denial. TypeScript/build checks verify the static bundle. API lint/type checks are separate. CI runs equivalent checks but has not executed remotely because no push is authorized.

The API has no fake assessment endpoint or local in-process job queue. Persistence/auth/model adapters are introduced in subsequent tasks. Container/free-host configuration is prepared early, but a Dockerfile is not evidence of a container build or deployment. Docker-engine and cloud-account checks remain separate gates.

## Likely committee follow-ups

**Why not run models in the API?** Memory/startup costs would exceed a small free API budget and couple slow inference to requests. A separate durable worker allows recovery and explicit queue progress.

**How do you prevent secrets leaking to the frontend?** Vite exposes only intended public identifiers; private values live server-side. Build contexts allowlist the API code/lockfile. Final bundle/secret checks remain required as functionality is added.

**Is this page already assessing applications?** No. This task establishes the verified application foundation. Actual processing must pass its own task acceptance checks before it is presented as working.
