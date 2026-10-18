# Access, deletion and resource checks

Verified locally on18 October2026; no deployed or external penetration-test claim.

The full API suite passes167 tests with no skips. Auth tests cover forged metadata, token validation and trusted roles; PostgreSQL RLS fixtures use two applicants and two cohort assessors. Submission/upload/job/evidence/review/clarification/report/similarity/comparison/provider-cache tests enforce their relevant owner/cohort boundary. Scoped pages do not become authorization substitutes.

JSON bodies are bounded before parsing, including chunked input:256KiB for public metadata,3MiB for internal worker envelopes, with15-second body reception. Private upload streaming retains its own authenticated byte/duration/page/type and60-second body bounds. Tests cover encrypted/corrupt formats, oversized data, silent audio review, malformed models, quota/timeouts and source instructions. Generated HTML is escaped and script-free; browser previews are sandboxed. Logs retain request IDs/types/timing without source/provider details. Provider URLs are operator settings; applicants cannot supply arbitrary fetch URLs or Overpass syntax.

## Permanent deletion

The owner/admin explicitly submits the current revision for deletion. The server rejects stale revisions and other users, fences all worker claims, hides the submission and attachments, then commits a durable tombstone before storage I/O. Object removal is idempotent and bounded to25 files per request; a removed object's attachment hash is cleared as cleanup progress. On storage failure, API202 says cleanup_pending, never deleted. A retry can finish even though ordinary reads are denied. scripts/cleanup_deleted.py is a dry-run by default; --apply resumes only previously requested tombstones. Operators should run that maintenance command if an interrupted client cannot retry.

After object cleanup, the server removes all revisions, sources, embeddings, cached explanations/context, reviews, jobs and related idempotency results. A minimal deletion event retains only the random resource UUID/type/time and empty metadata; earlier source-linked audit records are removed. The application cannot recall exports already downloaded or control an external provider's retention policy. No real user submission was deleted by verification: test erasure uses isolated synthetic local records.

The storage-outage recovery test verifies actual file removal, complete DB cascades, denied old downloads/reports and rejected stale worker publication, while an unrelated record remains. Browser acceptance separately exercises explicit confirmation and removal of an audio follow-up with history.

## Dependency findings

Initial npm audit found Vite7.1.10 advisories, including Windows alternate-path private-file access. Upgraded compatibly to7.3.7. Initial pip-audit returned12 entries (including duplicate advisory aliases) for Starlette0.48.0. API pins now FastAPI0.143.3/Starlette1.8.0, selected from PyPI compatibility metadata; the full suite passes under these versions. Both final audits report zero known findings in their checked lockfiles. This is a dated known-advisory check, not proof of absence of defects. Model libraries are a separate pinned/offline worker environment and are not exposed as the public API. The Starlette httpx TestClient deprecation is test-only and remains triaged.

Evidence: evals/reports/api-dependency-audit-before.json, api-dependency-audit.json and web-dependency-audit.json. Primary advisory: https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff ; FastAPI release notes: https://fastapi.tiangolo.com/release-notes/ . No auto-update, paid service or remote publication was introduced.
