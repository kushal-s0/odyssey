# Text normalization, translation and source-backed facts

The API stays lightweight. The authorized owned worker child runs
`app.pipeline.text:handler` for `extract:text`, `translate` and `structure`.
Stage input/capabilities, durable checkpoints and leases remain the T07 protocol.

`pipeline/normalize.py` preserves the original text, exact character offsets and
stable revision-derived evidence IDs. Sentences and long spans are bounded
without splitting decimal amounts. py3langid 0.3.0 supplies explicit text
identification; short/uncertain input falls back to the declared language and is
labeled as declared, never as automatically detected. Hindi and Marathi are not
distinguished by script heuristics. Detector probabilities are model scores,
not calibrated quality/fairness evidence.

Translation preserves both original and English text. Numeric tokens are
compared across Unicode digits, grouping and decimal notation. Changed numbers
remain flagged uncertain and cannot become supported facts. Each translated
segment is checkpointed before the next is attempted. English passthrough does
not call a translation model. IndicTrans2 uses pinned local assets and requires
reviewed/checksummed custom code before execution; absent access/review fails
closed. The current gated repositories returned HTTP 401.

`providers/local_models.py` imports model libraries only in the child. Qwen uses
the pinned pretrained artifact, finite context/output limits and at most one
JSON-format repair. Inference is local-only and does not download weights or
switch to paid endpoints. Provision weights explicitly using
`scripts/download_models.py`. Large downloads must match upstream checksums;
failed/truncated packages must never have hash checks disabled.

Qwen selects exact English quotes and segment indexes for permitted business
fields. `pipeline/structure.py` verifies every quote and derives the canonical
record deterministically. Unknowns stay null; contradictory supplied values stay
ambiguous. Negative/percentage/ambiguous figures never become fabricated cash
amounts. Additional business facts retain evidence. Applicant identity and
recognized source instructions are excluded from the model fact/scoring path;
original evidence remains available privately for review. These defenses still
need actual adversarial model checks and later hardening, not a universal
prompt-injection immunity claim.

The API reconstructs the business from submitted drafts/quotes and independently
checks revision ownership, exact original spans, prior-stage manifest and
numeric preservation. Translated source rows and the structured business row are
persisted in the same transaction as their stage publication. A rejected output
cannot leave a half-published business record. Completed publication replay is
idempotent. A changed preprocessing/model manifest cannot silently reuse an old
prior-stage output.

T09 status/evidence is in its task report. Source/model quality and language
review are distinct from parser tests. The base models are third-party open
weights, not models trained by this project. T09A is the separate relevance
experiment; T12 owns ratings and final atomic assessment persistence.
