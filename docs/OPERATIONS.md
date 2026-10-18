# Running and recovering the application

Use the ignored root `.env.local` and `start.cmd`. This starts the API on localhost:8000, web UI on localhost:5173 and one owned-laptop worker. Supabase provides login, application data and private originals. Docker and a second database are optional test tools, not application requirements. See [setup](SETUP.md) and [deployment](DEPLOYMENT.md).

## Start, stop and resume

Run `setup.cmd` once for missing dependencies/selected model weights, then `start.cmd`. Keep the laptop plugged in and awake during processing. Ctrl+C in the launcher stops only its children. Do not start a second worker on the same 8 GB GPU. Restarting the launcher resumes durable jobs after their leases expire; never delete jobs to fix a slow model. Logs stay in `.local/run-logs`. They and originals must not be published.

`/health/live` confirms the process; `/health/workspace` confirms application database availability. Neither certifies transcription accuracy. A 503 workspace check means repair the configured Supabase network/session-pooler connection before retrying. A slow queue may mean the laptop is asleep or the worker has stopped. Compare the job's stage/checkpoint and private worker log before retrying. The frontend keeps existing assessment versions when optional Groq or OSM requests fail.

## Local container and release artifacts

`docker compose -f infra/compose.yaml config --quiet` validates configuration without printing secrets. Stop the native API before `docker compose -f infra/compose.yaml up --build` because both use port 8000. It runs only the API; start the native worker separately using [deployment instructions](DEPLOYMENT.md). Do not copy the root env file into an image. The container has no weights or model frameworks and runs as a non-root user. The measured 512 MiB/one-CPU image smoke is in `evals/reports/api-image.json`; this is not a hosted deployment.

After the frontend build, run `.venv/Scripts/python.exe scripts/package_release.py`. Review local archives and their manifests under `.local/release/`. They contain allowlisted source or static files, with configured private-value checks. The static artifact uses local preview origins; rebuild it for approved HTTPS origins before publication. No command in the packager pushes or deploys. Source-tree checksums identify the exact files without depending on an uncommitted commit ID.

## Deletion and recovery

The applicant's explicit Delete action cancels/fences processing first, then removes private originals and derived records. A storage outage returns `cleanup_pending`; retry the same deletion after service recovery. For already requested deletions, `.venv/Scripts/python.exe scripts/cleanup_deleted.py` previews pending cleanup; add `--apply` only to resume these tombstones. This command does not select live submissions for deletion. Deletion is irreversible after completion.

Before any operator database maintenance, take an encrypted private export using the Supabase dashboard or supported `pg_dump`, plus a separately protected private-storage inventory/export. Record checksums and retention locally. Never commit exports or service credentials. Restore into a separate explicitly approved project first; verify Auth/profile IDs, private-object permissions, migrations and counts before changing the application DSN. A backup recipe is not a performed restore; hosted backup/restore remains unverified.

## Rollback and spending

Keep the previous local API image, source manifest and model manifest. Roll application code back as a unit with its generated contracts and compatible worker manifest. Add a corrective forward migration for database changes; do not edit checksum-tracked applied SQL. Stop new dispatch while replacing an incompatible worker, allow leases to expire and verify one synthetic job before resuming. Old assessments retain their own provenance.

The API deployment manifest selects Render Free, no paid workers, Redis, managed GPU or add-ons. Supabase is the sole database. Laptop electricity/network are still operator costs. Free plans and current quota dashboards must be checked before deployment; local measurements do not establish provider entitlement. Missing Groq free quota produces an unavailable explanation, not a paid fallback. Keep `ALLOW_PAID_SERVICES=false`. Public deployment, repository publication and model uploads require separate explicit approval.
