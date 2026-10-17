# Static frontend target

Build from `apps/web` with `npm ci` then `npm run build`. Publish only `apps/web/dist`, never the repository root. Public `VITE_*` configuration is baked in at build time; private keys must never use that prefix.

Deployment is not authorized yet. Prepare a reviewable artifact/destination, then obtain explicit approval. Cloudflare Direct Upload can publish the build without pushing GitHub, but it still requires publication approval. Final production SPA redirects/security headers and verified commands will be completed in T23/T27.
