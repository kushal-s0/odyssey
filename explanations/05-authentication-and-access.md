# Authentication and access

`apps/api/app/auth/jwt.py` verifies the signature, exact configured issuer and audience, integer issue/expiry times, UUID subject and authenticated token role. Only RS256/ES256 signing keys from the configured JWKS are accepted. The token cannot choose a key-server URL. Keys are cached for ten minutes; unknown-key refreshes are bounded to once per thirty seconds per API process. Provider failures deny access safely. This deployment requires Supabase asymmetric signing keys; legacy shared-secret HS256 is deliberately unsupported. Verify the project's actual signing configuration before deployment.

`auth/access.py` loads the role from `profiles` and memberships from the database using the verified subject. User-editable token metadata cannot grant assessor/admin access. `submission_access` enforces read, owner-change or assigned-assessor review boundaries. `resource_access` uses a fixed table allowlist and scoped SQL/RLS for files, jobs, evidence, assessments and reviews. Analytics and similarity must apply these same cohort/submission boundaries when implemented. A hidden resource returns 404.

`GET /v1/me` returns the trusted role and assigned cohorts. A valid Auth account without a provisioned profile receives 403. Browsers have no database write grants. Worker stages have no browser grant at all.

`apps/web/src/auth/` uses the official Supabase browser library for password login, session refresh and local logout. The API verifies its access token separately. An API 401 clears the local session and asks for sign-in; 403 preserves identity and explains missing workspace access. Account passwords are cleared when the dialog closes and never logged. Only public project URL/publishable key belong in frontend configuration. Root service credentials never go into a VITE variable. Do not include third-party scripts in this private workspace: a browser session still requires protection against XSS.

## Trusted judging-account setup (after private configuration)

1. Create limited password accounts in the project's Supabase Auth dashboard through operator/admin setup. Disable public signup for the judging project. Avoid depending on email delivery, SMS or magic links.
2. In the trusted SQL editor create two cohorts and record their UUIDs privately. Keep real and synthetic demonstration cohorts distinct.
3. Copy each Auth account UUID from the dashboard. With root `.env.local` filled and migrations applied, run `.venv/Scripts/python.exe -B scripts/provision_access.py --user-id ACCOUNT_UUID --role applicant --cohort-id COHORT_UUID` for each applicant. Use `--role assessor` for each assigned assessor. Never give ordinary judging accounts `admin`.
4. The command requires an existing Auth account, writes profile/membership atomically and adds an operator-provisioning audit event. It takes no password/service-key command-line arguments. Execute only against the intended private project; provisioning changes access.
5. Share login details privately with each judge. For recovery, the trusted operator resets the password through the Auth admin dashboard, communicates it privately and revokes the old session as supported by the provider. Do not post credentials in issues, screenshots, code or this guide.
6. Verify two applicants and two assessors on separate cohorts through the actual hosted UI/API, including denied foreign submission/file access. Hosted accounts and browser session refresh remain unverified until this is done.

Local checks use real RSA/EC signatures and PostgreSQL policies, with a synthetic JWKS response. Browser HTTP fixtures check UI transitions only. Neither is evidence that Supabase Auth has been deployed or configured.

References: [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [PyJWT verification API](https://pyjwt.readthedocs.io/en/stable/api.html).
