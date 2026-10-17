# udyam-answer-relevance-v1 — experimental, rejected for serving

This small logistic classifier uses frozen self-hosted all-MiniLM-L6-v2 features
(Apache-2.0, revision 1110a243fdf4706b3f48f1d95db1a4f5529b4d41).
We trained a classifier, not MiniLM or a foundation model. It is not a business
success, funding, credit or applicant-quality predictor.

Provenance, boundary and class errors remain possible: QA extraction and labels
are machine heuristics, no independently reviewed labels. All data comes from
11 private English-folder organizer PDFs; no synthetic accuracy claim. Related
business families are kept together. See RELEVANCE_LABELING.md and the actual
counts, split, metrics and hashes in evals/reports/relevance.json.

Features concatenate frozen masked-mean/L2 question embedding, answer embedding,
absolute difference and cosine; max 256 tokens. The 1153 features feed pinned
scikit-learn 1.7.2 LogisticRegression, liblinear, C=1, seed 20261017, max_iter 300.
No fitted normalization or holdout tuning. Fixed .3/.7 decision thresholds abstain
between boundaries. JSON coefficients/classes/intercept avoid pickle execution.
candidate.json pins data, features and versions; no private text is exported.

Promotion is rejected: reviewed pair count zero, family grouping unreviewed and
held-out families lack irrelevant-class examples. Available prototype metrics
cannot demonstrate real-world accuracy. models/relevance/serving.json explicitly
selects rules-cosine-baseline-v1. Low similarity abstains; it does not declare a
short or implausible answer irrelevant. The baseline itself is advisory and
unvalidated; it cannot directly alter evidence-backed potential scores.

Reproduce locally: run training/build_pairs.py with .venv Python, then
training/train_relevance.py with .venv-model Python. Original archives and pinned
MiniLM cache are required. Re-run and compare data/artifact hashes; no paid API,
upload or network inference is required. Dependencies are recorded in the owned
runtime lock and training/requirements.txt. CPU floating point reproducibility is
verified on this runtime, not guaranteed bit-for-bit across arbitrary hardware.

Next: independently review English/Hindi QA boundaries, labels and families;
collect both classes across multiple independent groups; repeat disjoint grouped
evaluation. Other languages remain unvalidated. No candidate deployment occurred.
