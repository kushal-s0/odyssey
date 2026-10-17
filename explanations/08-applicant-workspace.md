# Applicant workspace checkpoint

Signed-in applicant/admin users get the submission workspace; other roles retain
the existing preview until their assessor workspace is implemented. SubmitIdea
supports text, PDF upload and audio upload/recording. Consent, preferred language,
trusted cohort and optional declared location go to existing authenticated APIs.
The browser never infers cohort membership or assigns privileged roles.

Retry state contains only actor-scoped IDs, source fingerprints and idempotency
keys. It does not persist source text/audio in browser storage. Lost accepted
responses reuse the same key; file upload failure retains a retryable intent.
The API remains responsible for content validation, private bytes and durable
processing. Recordings use MediaRecorder, ten-minute/25 MB bounds and explicit
permission failure fallback. Playback/object URLs and media tracks are cleaned up.

MySubmissions retrieves actual saved records/status. Selected IDs survive refresh;
RLS applies again on every request. Polling is bounded and exposes waiting,
cancel/resume, failed and review states. Unimplemented PDF/audio processing is
clearly pending. Authorized original downloads preserve bytes.

AssessmentView displays server totals, completeness and evidence coverage
separately; a withheld headline remains withheld. Domain reasons link to original
and English segments with language uncertainty/locators. Model/baseline quality
is explicitly unvalidated and decisions remain with humans.

The Edge harness uses a synthetic signed issuer and browser microphone input,
while API verification, Postgres, private file operations and Qwen are actual
local integrations. Ten journeys passed; the pending-permission race is fixed with a synchronous
activity ref and a browser no-POST regression. Existing landing/auth browser
regressions also passed. See T08.md for exact evidence. Hosted
Auth, translations, human semantic review and deployment are not established.

The result panel now includes extracted business fields and original-source buttons. Missing/optional fields display Not supplied, never a fabricated zero.
