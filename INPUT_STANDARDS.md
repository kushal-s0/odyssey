# Input standards and account permissions

Shared validation lives in `shared/input-rules.ts`; both the React forms and Express API use it. The server assigns ownership and stores normalized structured answers alongside the generated source text. It rejects unexpected fields, including client-supplied owners or roles.

## Accounts

- Entrepreneurs create an account at **Connections & settings → Create entrepreneur account**. Registration accepts name, email and password only and always creates an entrepreneur role.
- Names allow 2–100 characters, including Indian scripts. Email is trimmed, lowercased, validated and unique. Passwords require at least 12 characters and at most 72 UTF-8 bytes, matching the password-hashing input limit. The form requires password confirmation.
- Assessor accounts are provided by the programme through the existing bootstrap configuration. Public registration cannot request assessor permissions or use the reserved assessor email.
- Sessions use HTTP-only, same-site cookies and expire after eight hours. Login and registration are rate limited.
- Entrepreneurs can list and open only their own submissions, original files and clarification sources. They can answer current clarification questions and retry their failed submissions.
- Assessors can inspect programme records, verify source fidelity, record reviews, find similar ideas, manage cohorts and review/export training labels. These endpoints enforce the assessor role even if someone bypasses the UI.
- Existing dataset imports and older assessor-created submissions remain assessor-visible. Names are never used to automatically grant an entrepreneur ownership of an existing record.

## Entrepreneur submissions

Every format requires an entrepreneur name of 2–100 characters, an idea title of 3–150 characters and a supported language selection. An entrepreneur's submission name must match their account. Cohort assignment is restricted to assessors.

### Guided form

Products and services require 10–1,200 characters. Other business answers are optional: customers (800 characters), problem (1,000), location (250), materials (1,000), suppliers (800), competition (1,000), differentiation (1,000), and experience (800). When supplied, these optional descriptions need at least three characters. Leave unknown answers blank rather than inventing them.

Financial rules:

- Currency is INR. Sales and operating costs are monthly projections; price requires its product/service unit.
- Blank amounts become `null` (unknown); an explicit `0` remains zero. Values allow up to two decimal places and must be finite and nonnegative. The technical input ceiling is ₹1,000,000,000; it is not a business-viability criterion.
- Indian and international comma grouping and Devanagari, Bengali, Telugu and Odia digits are normalized. Negative values, scientific notation and malformed grouping are rejected.
- When known, own investment and funding needed cannot each exceed total setup investment. Their combined known amount cannot exceed the total. A partially unfunded setup budget is allowed; missing funding amounts are not treated as zero.
- Monthly costs may exceed projected sales. The form does not force profitability or treat a forecast as verified income.
- Research status distinguishes unknown, not conducted, planned and conducted. Conducted research requires a description of at least 20 characters. Entering details requires a matching status. Planned research is explicitly serialized as not yet conducted.

### Free text, PDF and audio

Free text accepts 20–20,000 characters. PDF/audio inputs accept one source file, up to the configured size (10 MB by default). PDFs allow up to 25 pages. Recordings support MP4/M4A, OGG, MP3, WAV, WebM and FLAC, up to 20 minutes; browser recording remains limited to five minutes. The server checks actual file signatures; the browser also checks extensions and empty/oversized files. Uploads cannot carry conflicting free-text or guided answers in the same request.

Clarifications accept one written answer (10–2,000 characters) or one recording, a supported language, the current assessment version and one of the current clarification questions. Original evidence remains retained.

## Assessor reviews

Reviews require:

1. An explicit next-step decision: deeper evaluation, mentoring/skilling, clarification or reviewed.
2. A rationale of 20–2,000 characters.
3. One to four distinct reasons from the standard list.
4. One to twenty distinct source-segment IDs belonging to that assessment version.
5. Confirmation that the assessor reviewed the original source and supporting evidence.
6. A next action of 10–600 characters when a follow-up decision is selected; it is optional for reviewed.

The API checks the current version and rejects stale reviews with HTTP 409. It records the assessor ID, selected reasons, cited evidence, next action and review time. The assessment's rubric arithmetic is unchanged. A review records professional judgement; it does not establish business success or funding eligibility.

Deployment remains the user's responsibility. No local model training or trained-model inference is introduced by these changes.
