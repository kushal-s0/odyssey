# Owned worker operations

The outbound runner, native model handlers and final assessment persistence are connected. Real English/text/PDF and text/audio follow-ups have passed; regional and handwriting quality limits remain explicit. This is owned-laptop inference, with a separate optional loopback PostgreSQL test database. No hosted Space or public deployment has been verified.

## Configuration and startup

The API reads ignored root `.env.local`. Set `MODEL_RUNTIME=owned_worker` and
separate random `WORKER_CREDENTIAL` and `STAGE_CAPABILITY_SIGNING_KEY` values,
each at least 32 characters, alongside the API database/Auth/storage settings.
Apply migrations before starting/restarting the API, including the fifth
additive migration. Preserve existing secrets; never copy database/service-role
or capability-signing keys to a worker.

```powershell
if (!(Test-Path .env.worker.local)) {
    Copy-Item apps/api/worker.env.example .env.worker.local
}
.venv/Scripts/python.exe -B -m app.worker --help
```

Privately configure only `WORKER_API_URL`, a stable unique `WORKER_ID`, matching
`WORKER_CREDENTIAL`, and optional read/download `HF_TOKEN` in `.env.worker.local`.
Shell variables override the file; `--api` and `--worker-id` override those fields.
`--env-file` can select another worker-only private file. Existing `.env` remains
untouched; neither the API nor worker automatically reads it.

The API environment can run the synthetic probe. Real handlers additionally need
the separate pinned model environment and verified weights. Do not run two
sessions with the same worker ID. For a synthetic `orchestration-probe-v1` job
with stage `orchestration:probe` only:

```powershell
.venv/Scripts/python.exe -B -m app.worker --probe --session-seconds 60 --idle-seconds 10
# Explicit loopback development; the API must actually be running:
.venv/Scripts/python.exe -B -m app.worker --probe --api http://127.0.0.1:8000 --allow-loopback --session-seconds 60
```

The probe never claims screening jobs or creates assessments. Automated tests
create/clean their own synthetic jobs and exercise actual HTTP/subprocesses:

```powershell
.venv/Scripts/python.exe -B -m pytest -c apps/api/pyproject.toml tests/api/test_worker_process.py -q
```

`--handler module:function --stages ...` loads trusted operator-installed code. The implemented handler is `app.pipeline.run:handler` with `extract:text extract:pdf extract:audio translate structure assess`. Use the model environment, not the lightweight API environment:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --allow-loopback --handler app.pipeline.run:handler --stages extract:text extract:pdf extract:audio translate structure assess --continuous --stage-seconds 600
```

This separate command requires the narrow worker-only file above; the normal local `start.cmd` instead supplies worker values from the one root `.env.local`. For a remote API use its approved HTTPS origin and omit `--allow-loopback`. Do not run both launcher and separate worker on the same 8 GB GPU. Continuous mode runs until the operator stops it and polls actual work; it does not keep a free hosted model alive.

## Recovery and limits

Sessions default to 900 seconds, 60 idle seconds and 120 seconds per stage.
CLI bounds are one hour per session, five minutes idle and ten minutes per stage.
Poll backoff stops at session/idle expiry and caps at 30 seconds. Restart the
operator command for a new real processing session; no idle keep-alive exists.

Ctrl+C stops the child, cleans disposable input files during normal unwinding
and marks the runner offline when reachable. Abrupt parent termination closes
the child's stdin; its watcher exits even during model work. A separate
watchdog terminates computation on lease/stage expiry, including blocked HTTP.
Hard system crashes may leave private `udyam-stage-*` temporary directories;
remove only verified worker temporary paths after confirming owned workers have
stopped. Preserve original source archives and unrelated process files.

PostgreSQL retains accepted inputs, completed outputs and checkpoints. Expired
leases (default 180 seconds) are reclaimed with higher fencing generations.
Lost claim responses reuse a live claim without another attempt. Duplicate
publication is idempotent; conflicting output fails. Three failed attempts by
default require owner/admin inspection and explicit resume. Resume retains
completed work/checkpoints and never switches backend automatically.

Runtime presence expires after 90 seconds; crash detection is not instantaneous.
Reconciliation runs at startup and authorized submit/status/resume/publication
activity. Offline/sleep/quota states remain durable. No public laptop port,
tunnel, scheduler or anti-sleep pings are required; cloud/network availability
still determines progress.

## HTTP and model boundaries

`POST /internal/worker/claim` uses the bootstrap credential. A returned capability
binds worker/stage/job/revision/input hash/pipeline/manifest and generation.
Operations under `/internal/worker/{stage}` require that capability:

| Operation | Purpose |
|---|---|
| `POST /begin` | One execution invocation per generation before model import |
| `GET /input` | Scoped source metadata, previous outputs and checkpoint |
| `POST /source`, `GET /source/content` | Fresh private source access path |
| `POST /heartbeat` | Renew a live lease and capability |
| `POST /checkpoint` | Persist bounded work before continuing |
| `POST /publish` | Atomic idempotent publication |
| `POST /failure` | Retry, quota pause, review or terminal failure |

Source bytes are proxied through the API, with lease/capability/SHA-256 checks,
including after storage access. The worker verifies hashes again, constructs
paths under its configured API origin and never follows redirects with tokens.
Deployed calls require HTTPS; explicit loopback HTTP is for local checks only.
The bootstrap credential cannot substitute for a stage capability.

The parent owns network/heartbeat/capabilities. The child receives input/local
path and metadata without claim, signing, database, service-role keys or API
capabilities. Trusted handlers yield JSON-compatible `{'checkpoint': payload}`,
then `{'publish': payload}` or `{'failure': {'code': supported_code}}`. Every
event waits for durable acknowledgement before further bounded work. Output is
limited to 450 KB. Child diagnostics are suppressed to avoid source leakage.

User paths `/v1/jobs/{job}`, `/cancel` and `/resume` use existing applicant/cohort
permissions. Only owner/admin may cancel/resume; resume requires
`expected_revision_id`. Public progress excludes source data/capabilities.

## Gradio target: live verification pending

## Owned English screening handler (T09/T12)

After provisioning the pinned local cache and installing the isolated model
dependencies, the implemented text handler is `app.pipeline.run:handler`:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --handler app.pipeline.run:handler --stages extract:text translate structure assess
```

Configure the existing ignored worker API URL and bootstrap credential first;
the API separately needs database/auth/private-storage/signing configuration.
Use explicit `--allow-loopback` only with a local HTTP API. This command does not
create hosted accounts or configure missing credentials. It opens a bounded
outbound worker session; no public laptop port is necessary.

Current machine: measured RTX 3050 Laptop 6 GB, not the older RTX 5050 profile.
Pinned weights are local and inference offline; heavy libraries never enter the
API image. English synthetic HTTP checks reached stored assessments; see the
actual timings in evals/reports/feasibility/owned-assessment.json. These are local
measurements, not deployment or human-quality validation. Indic translation is
gated (401), and some longer exact-quote extraction cases still require review.
PDF/audio extraction handlers remain T10/T11. Never advertise those as completed.

## Gradio target: live verification pending (continued)

Only explicit `MODEL_RUNTIME=hf_zerogpu` selects configured owned
`TEXT_DOCUMENT_SPACE_URL` and `SPEECH_TRANSLATION_SPACE_URL`. The bounded adapter
uses `POST /gradio_api/call/run_stage`, a five-second timeout and optional private
Space `HF_TOKEN`. Events contain capability/metadata, never source files/text.
It stores intent before HTTP, then the event ID or an `uncertain` receipt. An
uncertain POST is never blindly retried in the same generation. Genuine activity
or bootstrap-authorized `POST /internal/worker/dispatch` attempts bounded enqueue.

`app.worker.gradio.run_event` is a proposed CPU wrapper: `/begin` authenticates
before launching its trusted handler. Do not GPU-decorate the wrapper. Duplicate
events cannot enter inference twice in a generation. Expired queued capabilities
fail closed; later activity reclaims/displays a new generation and fresh token.
The queue/event cache is not durable job storage. Completion uses restricted API
publication and can enqueue the next stage.

Actual Space provisioning, ZeroGPU process compatibility, auth/quota attribution,
sleep and live enqueue remain unverified. Tests simulate Gradio HTTP responses;
they do not prove live HF gates. [Official enqueue protocol](https://gradio.app/4.44.1/guides/querying-gradio-apps-with-curl).
