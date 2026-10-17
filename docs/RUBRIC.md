# Proposed rubric v1 - explainable first-level assessment

This is a project-proposed rubric, not an organizer-supplied scoring formula or a validated funding predictor. Stakeholder calibration remains necessary. The six potential dimensions have weights 15/20/20/25/10/10; information completeness is separate. Names, gender, social category, schooling, grammar, language and accent do not enter the scoring payload.

## Domain-specific anchors

| Dimension | 0 - evidenced weakness | 1 - weak support | 2 - plausible, limited | 3 - well supported | 4 - concrete validation |
|---|---|---|---|---|---|
| Clarity (15) | Supplied offer/operation is explicitly incompatible or incoherent | Offer mentioned but operating model remains poorly explained | Offer and customer understandable; important operational detail thin | Offer, customer and operating model consistently described | Precise, internally consistent model with concrete validated operating detail |
| Customer need (20) | Evidence contradicts the claimed need | Vague demand claim, little customer/problem connection | Specific customer problem but mainly assumption | Specific problem plus described customer conversations/orders | Concrete verified demand evidence; self-reported claims remain labeled |
| Market potential (20) | Supplied market assumptions conflict with facts/economics | Unbounded market/demand claim without a reachable segment | Plausible local segment with limited research | Reachable segment, channel and specific research findings | Independently checked demand/channel evidence supports the reachable market |
| Feasibility (25) | Supplied critical resources or arithmetic show a serious unresolved weakness | Broad plan with weak resource/supplier/funding explanation | Resources and investment plausible; some operational/economic detail thin | Coherent resources, supply, funding and compatible economics | Concrete checked resource/supply/cost evidence; no critical unresolved inconsistency |
| Competition (10) | Supplied evidence shows no credible response to known alternatives | Vague/no-competition claim without support | Some alternatives identified; response generic | Specific alternatives and grounded response | Verified context plus concrete validated competitive response |
| Differentiation (10) | Claimed advantage contradicted by supplied facts | Generic superiority claim | Plausible distinction, limited customer relevance | Specific customer-relevant distinction supported by the proposal | Concrete checked evidence that customers value the distinction |

No evidence, unreadable material and unresolved conflicting evidence produce **null**, never zero. Zero requires supplied evidence of a weakness. A short answer can be relevant. An implausible numeric claim can still be on-topic; relevance, plausibility and factual validation are separate. OSM listings are incomplete context, not evidence that rural/informal competition is absent.

## Exact arithmetic and headline rules

For assessable dimensions, calculate `100 * sum(weight * rating / 4) / sum(assessable weights)` with Decimal and half-up rounding to two decimal places. Evidence coverage is assessable weight / 100. No assessable dimensions produces null potential.

Below 70% coverage, unresolved offer/customers or ambiguous critical numbers/location suppress the headline total. Preserve the provisional calculation and domain values for review; the threshold is a proposed product rule, not statistical confidence. Rank only when all six domains are assessable and no critical issue remains. Queries must also enforce same rubric version and authorized population; the pure arithmetic function does not establish those query permissions.

## Completeness policy

`applicable_fields_v1` contains 18 fields: business_type, offer, target_customers, problem, location, market_research, raw_materials, suppliers, investment, own_funds, requested_loan, unit_price, revenue, expenses, profit, competition, differentiation and existing_business. Count only present, evidence-backed, usable values; a supplied false existing-business answer is usable. Summary/model confidence/extra technical facts do not inflate this denominator.

Default applicability is fixed before looking at scores. Only trusted reviewer policy may exclude raw_materials, suppliers, requested_loan or profit with a documented business-applicability reason; applicants/model output cannot self-exclude missing answers. Essential offer/customer fields cannot be removed. Persist policy/rubric version and every exclusion reason. This initial checklist needs stakeholder review; low completeness must never be treated as automatic business failure.

## Terminology and comparison

Domain means assessment dimension; sector is industry filtering. Trade is a controlled project taxonomy, not supplied ground truth. Cohort means trusted program membership, not a language folder. Across-cohort comparisons show within-trade composition, counts, exclusions and rubric version. Incomplete records appear in a clarification/review queue instead of competing with full-denominator scores. Small samples support descriptive displays only.
