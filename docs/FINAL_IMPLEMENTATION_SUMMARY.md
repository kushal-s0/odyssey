# Current implementation and evidence

Prepared 18 October 2026. The application runs locally with real Supabase login/private persistence and an owned-laptop worker. **No public release URL exists.** Implemented features and passing software checks are distinct from human-validated model accuracy and hosted release acceptance.

| Brief requirement | Implemented behavior | Evidence and limits |
|---|---|---|
| Understand business submissions | Text, digital PDF, scanned PDF and regional recording handlers, bounded source evidence and English translation | Actual text/digital-PDF assessments pass; full scan processing completed with unreadable pages. Regional matrix and failures are in `evals/reports/audio-matrix.json` |
| Consistent assessment | Six potential dimensions, separate completeness/coverage, evidence-linked reasons and deterministic totals | API recomputes scores; unreviewed sources withhold headline/ranking; no funding-success prediction |
| Missing/irrelevant/conflicting answers | Explicit field states, unknown amounts remain null, contradictory values remain alternatives | Grounding and adversarial tests; source instructions and identity excluded from judgments |
| Useful follow-up | Three prioritized questions, prepared five-language question copy, text/audio answers and immutable linked revisions | Real owned-model follow-up acceptance passed; translations need fluent human review |
| Assessor review | Scoped queue, source inspection/download, recommendations, transcript correction/verification and version history | Local two-user/cohort and browser tests; complete hosted role/refresh matrix remains unverified |
| Similar ideas | Pinned MiniLM vectors, authorized current-revision pgvector candidates, grounded shared traits/differences | Real encoder smoke and permission tests; reviewed Recall@5 unavailable |
| Local context | Confirmed coarse coordinates/category, bounded attributed OSM lookup and dated regional fallback | Actual public lookup passed; sparse listings do not prove absence of competition; Nominatim disabled |
| Four comparisons | Domain, trade, cohort and across-cohort views with grouped bars, completeness/rating scatter, table/CSV, exclusions and scored denominators | Known aggregate fixtures and local browser checks; ranking requires compatible complete judgments. Assessment radar omits unknown dimensions |
| Arithmetic | Exact money/period handling, revenue/funding consistency checks, uncertainty preserved | Supplied 120 × INR10 × 25 = INR30000 monthly revenue, not profit |
| Explain and share results | Optional English/Hindi Groq explanations with citation/numeric guards, saved fallback, authorized historical HTML and print/PDF | Actual Groq checks and multipage local browser print; explanations cannot rescore |
| Usable interface | Responsive applicant/assessor workspaces, dark/light/system themes, record/upload preview, source disclosure and errors | Local Edge journeys, mobile overflow and JS error checks; no public browser acceptance yet |
| Private durable processing | Supabase-only app persistence, fenced leases/checkpoints, access checks and explicit source/derived deletion | Real owned follow-up/recovery plus local security tests; deletion retry keeps tombstones private |
| Evidence confidence and rehearsal | Counts of grounded/unresolved facts and source flags; 18 synthetic text/PDF/audio inputs and explicit demo-family metadata | All sample files passed actual local admission and intact-source checks. Fictional source keys are not verified market facts or population model labels |

## Models and configuration

Pinned pretrained Qwen3-VL-2B performs grounded structuring/judgments, PaddleOCR-VL-1.5 handles page OCR, Whisper turbo transcribes supported languages, a separate ARTPARK-IISc model handles explicitly selected Odia, NLLB600M translates and MiniLM384 supplies advisory retrieval/relevance. These are third-party open weights, not foundation models trained here. The project's small answer-relevance experiment was rejected for promotion. Model identities, licenses and limits live in `models/manifest.json` and `models/PROVENANCE.md`. NLLB is noncommercial research/hackathon use.

Root ignored `.env.local` is the local configuration. Existing filled settings are preserved. `GROQ_API_KEY` is server-only; the user's configured `openai/gpt-oss-20b` preference is retained. Public OSM requires no key. Vite receives only public `VITE_` settings. No paid model or hosting fallback is selected.

## Validation and remaining work

Current exact test/build/browser counts are in `evals/reports/product-completion.json`. Security dependency audits and real provider checks have separate artifacts. The owned local metadata benchmark measured 4,988 requests across two API processes with p95 212.115 ms and zero errors at the recorded three-second session pace; charts alone were slower and overload diagnostics failed the latency goal. This is not GPU throughput or free-cloud capacity.

The private review screen accounts for all 55 original inputs. No human references have been supplied, so population accuracy, handwritten quality, regional WER, annotated retrieval and equivalent-language fairness remain unvalidated. Failed real-model cases are retained and never converted into passing accuracy claims. Free-host account entitlements/provisioning, public publication, clean deployed reproduction, sleeping-host recovery and live quota exhaustion remain outstanding. See [readiness](PRODUCTION_READINESS.md), [evaluation](EVALUATION.md), [operations](OPERATIONS.md) and [task status](../planning/TASK_STATUS.md).
