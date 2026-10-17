# Grounded judgments and server totals

The native pipeline entrypoint dispatches text stages followed by assess. Shared
assessment_rules selects usable fields for each rubric dimension. Missing,
ambiguous and translation-uncertain evidence cannot support a numerical rating.
The rater receives validated business fields and allowed segment references,
never applicant identity or full source instructions. Each eligible dimension
gets one bounded Qwen call with one JSON-format repair; per-domain checkpoints
resume acknowledged work. Numeric reasons cannot introduce unsupplied figures.
Self-reported proposals are capped at 3: anchor 4 needs independent validation.

MiniLM cosine runs on CPU and supplies the explicitly selected advisory baseline.
Its confidence/similarity never changes potential, completeness or coverage.
The unpromoted experimental head is not loaded. Every advisory check states it
is unvalidated. Domain judgments are also model suggestions requiring human review.

The API independently checks prior manifest, stored business payload, domain
evidence, model/version and rubric. It chooses assessment UUID/version/time and
calculates exact Decimal weights using domain/scoring.py. Workers cannot supply
scores or applicability exclusions. Assessment, six ratings, stage publication
and job completion commit in one transaction. Invalid/duplicate/stale writes use
existing fencing and rollback rules; final completion still requires an assessment.

Authenticated assessment/evidence routes enforce submission/resource RLS. The
latest assessment must match the current revision. Original/English segments
remain available to authorized readers; absent assessments return 404 with a
processing explanation. Client displays completeness separately from potential
and withholds the headline/ranking according to the existing rubric policy.

Committee: Are scores objective predictions? No; the proposed rubric needs
stakeholder calibration. Deterministic arithmetic is verified, whereas semantic
model quality needs independent review. A completed processing job may correctly
produce a withheld headline and clarification gaps. Other language processing
remains limited by T09's recorded gates. PDF/audio extraction waits for T10/T11.
