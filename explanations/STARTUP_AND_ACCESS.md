# Why login could succeed while the app did not work

Supabase Auth checks the password and supplies a signed session. The API then verifies that signature and looks up `public.profiles` and cohort memberships. These are separate steps: an Auth account alone has no application access.

The failing session had an API process whose initial database connection had failed. That process retained its unavailable state even after `.env.local` was corrected. The hosted project also had no profiles or cohorts. The landing page checked process liveness and displayed a green badge despite unavailable persistence, then continued showing promotional content after a successful password login.

The launcher now waits for an actual database-backed workspace check before starting the usable app. The header checks the same endpoint. A signed-in user sees an explicit workspace loading/error state with a retry button; signing out remains available. `/health/live` still means only that the API process is running. `/health/ready` retains its stricter, unverified storage/model warnings.

Trusted setup applies checksum-tracked migrations and assigns a selected Auth account an applicant profile and cohort. It never grants browser-controlled roles or promotes all Auth accounts. Configuration changes require restarting `start.cmd`. Passwords, database URLs and service keys stay in ignored root `.env.local`.

Real verification uses an explicitly approved disposable Supabase account, real signed sessions, hosted private storage and the owned laptop model. Its credentials stay under ignored `.local/`; cleanup targets only that account's artifacts. Browser fixtures elsewhere remain labeled as fixtures.
