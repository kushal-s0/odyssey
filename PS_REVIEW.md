# Evaluation against the problem statement

## Implementation follow-up

The review below records the pre-change state. The subsequent implementation adds an interactive map with confirmed coordinates, numbered markers, managed Geoapify lookup, public/cached fallbacks and separately sourced manual observations. A live generic Pune lookup returned 71 food listings within 1 km, with valid radius checks and source IDs. Market coverage is not exhaustive.

The live clarification flow now passes. Assessors can assign existing submissions to cohorts. Information readiness is distinguished from provisional screening concerns and separate source-backed human domain ratings used in comparisons. The evidence workspace provides original/English comparison, highlighted quotations, search, source filters, page/audio links and an expanded reading view with explicit source confirmation. Free text is the default intake mode.

These changes address the identified product/workflow gaps. They do not prove regional-language accuracy, calibrated business ratings, improved assessor decisions or sustained processing capacity. Independent language checks and an assessor pilot remain necessary. Custom relevance inference and deployment remain separate, user-owned steps. See README.md for current usage.

18 October 2026. Based on `.planning/problem-statement.txt`, the current source code, saved verification results and a local synthetic scoring experiment. This review changes documentation only; it does not deploy, train or send submissions to providers.

## Honest verdict

The project is a useful foundation for a human-supervised screening assistant. It can consolidate a proposal, preserve evidence, highlight missing information and help an assessor inspect it. Those functions directly address the PS's manual reading and organization problem.

It is not yet a demonstrated business-potential assessment solution. Its main numerical rating measures the presence of supporting information much more than the quality or commercial implications of that information. Language fairness, assessment agreement with real assessors, time saved and near-real-time performance have not been measured. These are important outcome gaps despite broad feature coverage.

There is no defensible overall completion percentage: implemented features, validated output quality and operational readiness are different things. The code is close to a supervised pilot; evidence that it improves assessment decisions is still missing. A few hours can produce a more honest, coherent and better-tested MVP. Establishing dependable regional-language quality and programme-wide usefulness requires further human-reviewed cases and real assessor use.

## PS requirement mapping

| What the PS asks for | Current evidence | Assessment |
| --- | --- | --- |
| Accept text, PDF and audio in regional languages | All three intake paths exist. Four PDFs across English/Hindi/Marathi/Telugu processed; one 15-second Hindi audio test passed. Bengali and Odia content quality remains unverified. | Broad implementation; incomplete language/format validation. |
| Translate to English, structure the idea and retain the original | Originals, extracted/transcribed text, English text, citations and structured fields exist. Citation checks do not prove translation correctness. | Strong fit in design; human quality checks needed. |
| Understand products, customers, problem, location and finances | Nineteen fields, exact-source checks, explicit unknowns and missing-question logic exist. | Useful for organizing applicant statements; not independent verification of those statements. |
| Rate clarity, customer need, market potential, feasibility, competition, differentiation and completeness | Dimensions exist, but scores mainly count supplied fields. Strengths often say an area is described rather than establish a commercial advantage. | The largest substantive gap. Information readiness is only part of assessment potential. |
| Highlight strengths, gaps, risks and areas needing validation | Missing/conflicting fields, financial stress calculations, sources and review reasons exist. | Useful first-level assistance. Financial checks are assumptions-based screening rules. |
| Identify similar beneficiary ideas | Embedding/keyword retrieval and duplicate exclusions exist. | Feature present; usefulness needs a few assessor-checked similar/different pairs. |
| Identify similar nearby businesses using reliable available data | Place confirmation, category/radius, sources and provider fallback exist. Live geocoding passed; live business-listing providers failed. | Partial delivery. A visible error is honest, but does not supply the requested local insight. |
| Provide one consolidated assessment for mentoring, skilling, deeper review or funding consideration | Main detail page and structured review exist. Overall score and separate financial concerns can tell different stories without an obvious screening conclusion. | Mostly assembled; needs clearer decision guidance for an assessor. |
| Domain, trade, cohort and across-cohort comparisons | Comparison views exist. Entrepreneur signup/submission cannot assign a programme cohort; current routes have no later cohort-assignment action. Assessor-created submissions can set it initially. | Views exist, but ordinary entrepreneur submissions can remain unassigned and weaken programme comparisons. |
| Preferably operate in real time and scale screening | Background jobs, progress, retries, checkpoints and bounded concurrency exist. No representative processing-latency or assessor-time measurements are recorded. | Resilience is implemented; speed and capacity are unproven. |
| Avoid disadvantaging beneficiaries because of format, language or formal business knowledge | Free text and audio are available, but the guided form is the default and much interface text is English. More polished/complete submissions can receive better readiness ratings. | Partial accessibility. Do not require all nineteen answers before an assessor can help. |

## Concrete scoring experiment

I called the existing built assessment function locally using two synthetic, fully described meal-service proposals. No AI request or database write was involved. All supplied fields had exact matching synthetic source segments.

| Input/output | Proposal A | Proposal B |
| --- | --- | --- |
| Projected monthly revenue | INR 65,000 | INR 12,000 |
| Projected monthly costs | INR 35,000 | INR 35,000 |
| Simple projected operating result | +INR 30,000 | -INR 23,000 |
| Main rating returned | 75/100 | 75/100 |
| Completeness returned | 100% | 100% |
| Feasibility dimension returned | 3/4 | 3/4 |
| Market-potential dimension returned | 3/4 | 3/4 |

This does not establish that Proposal A would succeed: its figures are applicant projections. It does establish that the main rubric does not respond to this financially important distinction. The separate financial-risk calculation can distinguish the cases, but that does not change the main rating. The UI should make the distinction easy to understand.

## Will it be useful?

**Useful now with supervision:** opening originals beside a common English structure; collecting missing facts; spotting financial inconsistencies; inspecting cited evidence; preparing a consistent assessor review.

**Not established yet:** faster reviews in practice, correct regional-language extraction across the supplied formats, reliable local competitive context, or better identification of proposals needing deeper business evaluation.

**Unsuitable for automatic decisions:** approving funding, rejecting applicants on the main score, ranking business viability by completeness, or treating missing local listings as absence of competition.

The custom relevance classifier is not the central solution to these gaps. It detected four of ten off-topic examples in the saved grouped evaluation and is not connected to hosted inference. The PS does not require custom training. New external training should not consume the remaining critical-path time.

## Smallest practical improvement plan: three deliverables

These are estimates for focused engineering and validation, not guarantees. Aim for roughly three to five hours including integration/provider delays. Stop adding unrelated features.

### 1. Make the assessment lead to an understandable action — 60–90 minutes

- Consistently label the existing numerical score as **information readiness** in the detail view, dashboards, comparisons and exports. Preserve the old rubric/version rather than silently rewriting stored assessments.
- Add one compact assessor-only **screening summary** using existing supported facts, missing/conflicting fields and financial rules: proposed next action, at most three reasons with sources, and the most important unanswered question. Missing facts should lead to clarification; concerning financial projections should suggest financial mentoring. Any recommendation remains provisional and assessor-confirmed.
- Separate **described**, **concern found**, and **not validated**. Market demand or differentiation should not be described as strong merely because a sentence is present. Use the existing assessor review to record confirmation and its supporting evidence.
- Keep first-line guidance separate from a funding decision. Do not replace the current rubric with an unvalidated model-generated success percentage.

Acceptance: the two synthetic proposals above may retain the same readiness score, but the loss-making proposal must visibly show a financial concern and a different provisional next step. The assessor must understand the distinction without opening multiple panels.

This improves practical PS alignment; it does not create a validated business-potential rating. Calibrated domain ratings require programme assessor input after the hackathon.

### 2. Close the two workflow gaps — 45–90 minutes

- Run the full live clarification path on a synthetic submission. If it fails, use the request ID and server error to fix that specific cause; confirm the answered field changes, the question disappears and history remains. The last saved live attempt returned HTTP 500; later automated tests alone do not close this gap.
- Add one assessor-only **assign/change cohort** action for existing submissions, with normal ownership/role validation and recorded changes. Entrepreneurs should not select programme membership. Show unassigned and demo cohorts explicitly.
- Keep free text and audio easy to choose. Prioritize the three most useful unanswered questions while keeping the full missing-question list available; do not turn every missing field into a blocking form requirement.

Acceptance: a self-registered entrepreneur can submit, answer one question and see an updated own-only result; an assessor can assign that record to its real or explicitly labelled demo cohort and see it in the relevant comparison.

### 3. Prove the useful outputs on a tiny evaluation set — 60–90 minutes

- Use about six representative checked cases: clear text, an approved regional-language PDF, a scanned-page case, the approved audio excerpt, missing data and conflicting numbers. Cases may overlap. Compare important extracted facts with originals; use a fluent reviewer for translations where available. Mark unreviewed language quality explicitly.
- Check a few known similar and unrelated idea pairs. Confirm the closest results help a human rather than merely sharing generic terms.
- Time-box live local lookup to 15–20 minutes within this task. Reuse properly attributed cached results only for their actual place/category/radius and disclose retrieval time. If providers remain unavailable, allow a sourced assessor-entered local observation with its date and verification status. Manual observations preserve practical usefulness but leave automatic location insights partially unmet; do not disguise them as a live API result.
- Record end-to-end processing time and one assessor's time to reach a next action on the same cases. Record important fact errors and whether recommendations match that assessor's judgement. These are small pilot observations, not general accuracy claims.

Acceptance: every displayed important fact in the chosen cases is correct or visibly unresolved; no API failure becomes “no competitors”; the complete demonstration runs successfully; the presentation reports observed timing and remaining untested languages honestly. If no assessor/fluent reviewer is available, record that limitation rather than claiming validation.

## Do not spend the remaining deadline on

- More custom training or a bigger unrelated dataset: neither is required by this PS, and neither fixes the main rubric or workflow automatically.
- Additional dashboards, animations, maps or generic chatbot features.
- Complex distributed infrastructure without evidence the single-process MVP is the bottleneck.
- Inventing a business-potential percentage, inflating the 75/100 readiness ceiling, or presenting manual local research as automatic discovery.

Deployment remains user-owned and is outside this engineering time estimate. The strongest demonstration is a regional-language submission that becomes a traceable English summary, receives a missing-information question, gets corrected, shows an explained screening concern and next action, and appears in a meaningful programme comparison.
