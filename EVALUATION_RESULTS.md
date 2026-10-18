# PS implementation and evaluation evidence

Updated 18 October 2026. No deployment or local model training was performed.

| Area | Observed result | Scope of the result |
| --- | --- | --- |
| Application regression suite | 115 passed | Validation, source rejection, financial rules, auth/isolation, cohort access, local context, managed/public map fallback and review evidence. |
| Browser regression suite | Full 44-test production-build run passed | Existing desktop/mobile workflows plus map, evidence, cohort and human-rating screens. |
| Final evidence safeguards | Eight targeted browser checks passed, including two new navigation checks | 46 distinct browser checks covered across the full and targeted runs. Late responses cannot replace current-record evidence; switching records clears selection/confirmation. |
| Production build | All workspaces passed; client rebuilt after final safeguards | Map code loads separately; the main JS chunk remains below Vite's default 500 kB warning threshold. |
| Live clarification | Passed on the existing labelled synthetic example | Missing revenue became supported; completeness increased from 93% to 100%; original clarification and version history were retained; stale revision rejected. This single request took about eight seconds and is not a capacity benchmark. |
| Live Atlas workflow | Eleven checks passed; temporary fixtures removed | Cohort assignment, stale-write rejection, map-context persistence, observation add/read/delete, distant-point rejection, loss concern, six-domain review persistence and review invalidation after evidence revision. No AI calls or participant records were used for these checks. |
| Live business listing lookup | 71 Geoapify food listings returned within 1 km of a generic Pune point | Returned coordinates passed radius checks and each listing had a provider ID and source link. A category match is not necessarily a direct competitor; coverage and the underlying claims need confirmation. |
| Live map browser | 71 listings and 71 markers; eight loaded tiles | Actual map imagery, provider attribution and list selection opening a popup passed. Confirmed settings were saved on the labelled synthetic demo. |
| Approved dataset PDFs | Four processed: English, Hindi, Marathi, Telugu; citation/value checks passed for all four | Translation accuracy has not been independently verified by a fluent reviewer. These are structural/source checks, not a 100% accuracy claim. |
| Approved Hindi audio | A 15-second excerpt produced a transcript | Word accuracy was not manually measured. Bengali/Odia audio quality remains unverified. |
| Custom relevance classifier | Existing grouped macro-F1 0.6783; off-topic recall 0.40 | Existing experiment only; no new training/accuracy improvement. Hosted custom inference remains unconnected and optional for the PS workflow. |

The source workspace keeps applicant statements, source-fidelity verification, financial screening rules and human domain judgements distinct. A checked quotation does not prove a business claim. Human ratings require current source citations; missing domains do not become zero scores. Funding decisions remain with assessors.

Remaining validation is human and operational: have a fluent reviewer check representative regional-language cases, have an actual assessor judge screening recommendations and related ideas, measure review time on those same cases, and exercise the intended simultaneous workload. These outcomes cannot be established from passing UI tests or a larger training dataset.

Reproduce automated checks with `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run test:ui` against a running local API serving the built client. See README.md for map configuration and the completed workflow. Live diagnostic metadata and screenshots are retained privately under the ignored `.planning/` directory; no secrets are included in this report.
