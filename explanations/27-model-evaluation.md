# Reading the implementation and model evaluation

The user requested a comprehensive task audit plus actual model tests on varied
perspectives. Main report: docs/IMPLEMENTATION_AND_MODEL_EVALUATION.md. A17-sheet
Excel workbook, standalone searchable HTML, per-sheet CSVs, raw synthetic
assessments and reference/metric JSON live in evals/reports/comprehensive/.

Frozen fixtures under evals/benchmarks were written before inference. Fourteen
business cases exercise the production text stages, restricted HTTP worker,
local Postgres publication and financial API. Results are actual model outputs;
the operator identity is an explicit existing test fixture. It is not a fresh
Supabase Auth verification. Model/runtime revisions and dataset hashes are saved.

The current machine is RTX3050/6GB, whereas later saved project reports used an
RTX5050/8GB. An isolated ignored .venv-eval shares the existing Torch packages
read-only and installs the current pinned Transformers/API stack; .venv and
.venv-model are preserved. Pinned public NLLB/Whisper/Odia/Paddle weights were
downloaded and hash-checked. Credentials and the running normal app were untouched.
Only loopback test migrations001-008 were applied; no hosted migrations occurred.

Actual results:192 API tests and five metric tests pass. Thirteen of14 business
cases complete;89/99 authored assertions pass. These are not89.9% population
accuracy. There are no independently reviewed success labels. A source can be
well described yet unverified; missing facts are not a bad entrepreneur.

The important negative-quality finding: four requested weak-domain judgments
produce zero actual low ratings, one cautious abstention and three ratings above
the expected ceiling. Arithmetic correctly flags losses/funding discrepancies,
but those checks do not automatically lower the model's ratings. This is why a
completed assessment, a50/100 provisional score or a withheld headline cannot
certify correct positive/negative business classification.

Other measured limitations: a supplied monthly-profit amount loses its period;
rough English loses investment; Hindi loses customers; the implausible-revenue
example stops in structure on both original and diagnostic repeat. NLLB preserves
numbers but omits one explicit loss clause. Raw Whisper produces a word on
silence, whereas the production RMS guard correctly publishes no transcript.

OCR's0% WER/CER covers only three typed/rendered-script images. Speech6.52% WER
covers three clean synthetic English recordings. Language matches13/13 authored
cases, automatically selecting a language in11; two short cases correctly
abstain. MiniLM finds all relevant items by rank3/5 in four tiny curated queries;
real retrieval Recall@5 remains unknown. The rejected relevance classifier labels
all16 QA answers relevant (50% accuracy, zero irrelevant recall); it remains
rejected. Odia has a real10-second functional run but no reference-based accuracy.

The report retains exact sources, expected/observed fields, domain reasons,
failed assertions, denominators, timing and VRAM. Five known-answer metric tests
check edit distance, Unicode normalization, empty references and WER above100%.
The workbook is reopened and checked for all29 tasks/99 assertions and zero
formulas. Edge verifies45 HTML tables, search,390px layout, no JS errors and zero
external requests. The original corpus, model code and scoring prompts were not
changed to obtain better test results. T20 remains blocked on independent human
annotations, regional references and real retrieval/fairness evaluation.
