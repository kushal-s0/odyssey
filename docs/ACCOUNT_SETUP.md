# Private account configuration while implementation continues

No code push/deployment is authorized yet. This page lists private prerequisites, not a claim of hosted integration. Never paste secrets into chat, source files, command arguments or screenshots for publication.

## Hugging Face

Accept the access conditions for the three AI4Bharat repositories linked in [SOURCES.md](SOURCES.md). Create a minimal read token and add `HF_TOKEN=...` to ignored root `.env.local`. The model probe reads it without printing its value. Do not buy a plan/GPU or enable paid inference. Free Space creation/upload is a separate approval/verification step.

## Supabase Free

1. Create a new **Free** project without paid add-ons. Record its chosen region; use a separate development project or local database for tests.
2. In the project's Connect dialog choose the **shared session pooler** if your network is IPv4-only. Copy its actual connection string to `DATABASE_URL` in ignored root `.env.local`. Keep SSL required for the hosted connection; do not buy the IPv4 add-on. URL-encode special characters in the database password.
3. Copy the project API URL to `SUPABASE_URL` and the private server service-role key to `SUPABASE_SERVICE_ROLE_KEY`. They belong server-side. Put only the publishable key in `SUPABASE_PUBLISHABLE_KEY` and later public frontend configuration. Do not confuse the two keys.
4. Read the project's actual JWT issuer/signing settings. For standard project URLs the issuer is normally the Auth URL ending `/auth/v1` and the asymmetric JWKS endpoint ends `/auth/v1/.well-known/jwks.json`; copy/verify actual values as `AUTH_ISSUER` and `AUTH_JWKS_URL`. Do not assume a legacy symmetric project has usable public signing keys.
5. Do not manually open storage buckets to the public. The reviewed migrations create the private originals bucket and access policies. Applying these to a hosted project and creating real demo users must be recorded as live checks when authorized/configured.
6. Do not depend on default email delivery for public signup or judging. Trusted limited password demo accounts will be created without committing credentials. Free default SMTP has recipient/rate restrictions.

The application will report unavailable/blocked infrastructure until real checks pass. Configured strings alone do not establish a deployed database, working auth or private storage. The final T27 guide will document the complete verified deployment/recovery procedure for the finished configuration.
