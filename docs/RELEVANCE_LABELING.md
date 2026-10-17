# Answer relevance annotation policy

Relevant means the supplied answer addresses the business question, including
short answers and implausible financial claims. Irrelevant means it supplies an
unrelated answer; business vocabulary alone does not establish relevance.
Missing, illegible, mixed-language uncertainty and contradictory figures are
separate states. Never infer business success or applicant suitability.

T09A uses machine-proposed QA boundaries and keyword labels from private organizer
PDFs. These are not ground truth. Names/contact/demographic questions and detected
identity-bearing answers are excluded. Raw pairs and embeddings stay ignored in
evals/private/relevance; no dataset redistribution permission is established.
Inspect/redact manually before any sharing. English-folder membership is not
language validation. No human review has occurred.

Group by coarse business family, pooling unknowns with tea to avoid splitting
the irrelevant tea variants from their related examples. No translations are
included. Future translations/variants must join their source's family before a
split. Groups remain unreviewed and cannot support a release-quality claim.

Before fitting, audit counts. Keep the sole negative-containing family in train,
reserve two positive-only families by seed-hashed order for validation/test.
This permits a bounded fit but leaves no held-out irrelevant examples; report
macro-F1 and irrelevant precision/recall as unavailable on one-class holdouts.
Thresholds .3/.7 and C=1 are fixed; no holdout tuning. Promotion requires reviewed
independent two-class groups, macro-F1 >= .80, irrelevant precision >= .90 and no
baseline deterioration. This run necessarily rejects promotion.
