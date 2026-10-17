# Optional Groq explanations — 18 October 2026

## Status
- State: `blocked`
- Scope: newly authorized optional explanation provider; supplements T12, does not replace owned scoring.
- Uncommitted; live key/account/model availability still unverified.

## Outcome and checks
providers/groq.py, routes/explanations.py, contracts/explanations.py and ExplanationPanel.tsx explain saved results in English/Hindi with field references, next steps, provenance and cached rule-based fallback. The provider cannot mutate scores. Raw files/transcripts, applicant identity and contact fields are excluded; contact patterns in structured text are redacted. Output schemas, domain completeness, present-field citations and unsupported numeric tokens are checked. These guards do not prove factual correctness; explanations remain labelled for evidence review.

`pytest tests/api/test_explanations.py -q`: 3 passed using local PostgreSQL and explicit provider fixtures. Verified missing-key fallback, malformed/missing-fact/numeric rejection, provider 429, cache, stale assessment, ownership and unchanged saved scores. This is not a live Groq test.

## Configuration and sources
Root .env.local now contains missing optional names without overwriting filled values. Supply only GROQ_API_KEY and restart start.cmd. GROQ_ENABLED defaults true; GROQ_MODEL defaults openai/gpt-oss-120b. The initially considered Llama model is now listed for enterprise access, so the default was corrected after checking current official docs. No paid fallback. The user must keep their Groq account/project on its free plan; application request limits do not independently certify account billing.

Current references checked: https://console.groq.com/docs/models , https://console.groq.com/docs/rate-limits , https://console.groq.com/docs/reasoning . Default low reasoning effort and hidden reasoning use documented GPT-OSS parameters. Actual model access/free quotas are account-specific, not an unlimited-service claim.

Migration 006 supplies a scoped durable feature cache. Shared PostgreSQL limits bound requests; pending requests expire for crash recovery. Provider timeout is bounded; saved assessment survives failure. Live English/Hindi generation and human explanation review remain blocked until the key is configured. No publication or source upload.

## Follow-up verification, 18 October 2026

The user explicitly approved migration 006; it was applied to configured Supabase. All six read-only schema/access checks passed, including RLS, vector schema usage and denied direct browser writes. No filled Groq key or live generation is claimed.

## Live configured provider check, 18 October 2026

The user filled the key and selected openai/gpt-oss-20b; their filled model setting was preserved. scripts/verify_groq.py sends only an invented tea/office-worker example, never DB/applicant records. Real English and Hindi generation both passed with six domain notes and unchanged scores, in 1.070/1.116 seconds. The first Hindi attempt returned unavailable and was not accepted; a later explicit verification passed. No automatic paid fallback or human factual-quality claim. Provider guards now retain safe error-type/status diagnostics without response/secret leakage. Three explanation regression tests pass after this change. Report: evals/reports/groq-live-synthetic.json.
