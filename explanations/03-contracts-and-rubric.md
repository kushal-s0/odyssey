# Contracts, evidence and deterministic scoring

`contracts/models.py` is the shared vocabulary for the API, worker and generated frontend types. `EvidenceField[T]` supports strings, lists, booleans, money and locations while retaining a common status/evidence/alternatives shape. Unknowns are null. `False` is a valid present boolean, so a person saying they do not already have a business is not counted as missing.

`Assessment.traceability()` validates domain uniqueness, evidence identity and source references. Evidence may originate in an earlier revision of the same submission because clarification retains original source history. Authorization and source bounds are additional resource checks; schema validity alone never proves permission or truth.

`LanguageResult.detector_provenance()` separates selected/confirmed language from model detection. Selecting Hindi cannot manufacture a 99% detection confidence. `Money` keeps units/periods alongside Decimal amounts. Additional technical facts are retained without treating applicant identity as a scoring feature.

`domain/scoring.py:summarize()` calculates the proposed rubric with Decimal arithmetic. It reports potential, coverage and completeness separately. Low coverage/unresolved critical facts withhold a headline score; partial denominators cannot enter rankings. Completeness defaults to a versioned 18-field checklist; only trusted reviewer policy can exclude specific inapplicable fields with reasons.

`contracts/schema.py` and `scripts/export_openapi.py` expose/export the same Pydantic catalog. The frontend generator converts it into TypeScript; `api/client.ts` adds bearer-authenticated requests, cancellation and safe errors without inventing endpoints. Runtime output validation stays server-side.

## Questions for judging

**Why separate completeness from potential?** Missing information tells us what to clarify; it is not evidence that the business is poor. A complete but weak proposal and an incomplete promising one need different next actions.

**Why can partial scores not be ranked?** Their denominators differ. A single strong dimension could otherwise outrank a thoroughly assessed idea. Ranking also requires matching rubric versions and authorized comparable populations.

**Does evidence linking prove a claim?** It proves traceability to a source, not independent truth. Applicant claims remain self-reported; reviewers can validate/correct them and retain history.

**Can the model decide the overall score?** It may propose bounded evidence-grounded domain judgments once T12 is implemented. Python calculates totals and eligibility. The proposed rubric remains a review aid, not an automatic funding decision.
