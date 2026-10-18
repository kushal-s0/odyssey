# Evaluation and accuracy evidence

All 55 organizer inputs are inventoried by source SHA256: 42 PDFs (109 pages), 11 MP4 and two OGG recordings (2,250.366 decoded seconds). Every source was structurally inspected; all 13 audio files decoded. Counts by folder hint: English 11, Hindi 11, Marathi 11, Telugu 15, Bengali two and Odia five. These folder labels and conservative family hints are not human ground truth. Source names, transcripts and originals stay private.

## Human review and reproducible metrics

Run `.venv/Scripts/python.exe scripts/prepare_review.py` and open `.local/review/index.html`. It verifies all original hashes and prepares an offline PDF/audio viewer with explicit language, reviewer, business-family ID, split, exact reference and expected fields. It can export private annotations; save the result as `.local/review/annotations.private.json`. Local browser autosave is best effort; export before closing. Only English/Hindi human reviewers are currently available. Do not mark other languages reviewed merely because a machine translation looks plausible.

Run `.venv/Scripts/python.exe evals/run.py`. Optional `--predictions PATH` accepts private records with `id`, `transcript`, `fields` and `retrieved_ids`. Missing annotations yield zero reviewed inputs and null metrics, never invented accuracy. The evaluator rejects duplicate/unknown IDs, unavailable human-language coverage and families crossing train/validation/test. Only reviewed **test** sources with predictions enter measurements. It reports word/character error numerators and reference denominators, exact labelled fields, numeric exact matches and relevant retrieval hits at five. Unicode NFC and whitespace/case normalization are documented in code; numbers use exact Decimal comparison, not approximate matching. Long alignment pairs exceeding the resource budget must be reviewed/evaluated as bounded pages/chunks.

`evals/reports/corpus-evaluation.json` contains aggregate counts only, with no source or prediction text. The latest run accounts for all 55, with **zero human-reviewed references**. Therefore WER, field accuracy, Recall@5 and fairness are not validated. Population and release-quality gates remain false even when a small measured set becomes available; a threshold and representative reviewed sample are separate decisions. Specialist rating/evidence annotations and equivalent-language pairs remain required.

## Actual inference and functional checks

The connected models are pinned third-party open weights, documented in `models/PROVENANCE.md` and `models/manifest.json`. They were not trained by this project. The separately trained answer-relevance experiment was evaluated and rejected for promotion; its baseline remains selected. See `evals/reports/relevance.json`.

- Actual owned English assessment and live Supabase text/digital-PDF workflows passed. These prove integration, not population accuracy.
- Full 11-page Hindi scan extraction/recovery completed in 415.188 seconds with 49 uncertain segments. Three pages yielded no usable transcription. This is a quality failure requiring review, not an OCR accuracy pass.
- Hindi and Odia ASR chunk smokes passed with private transcripts and measured VRAM. The complete recording matrix is recorded separately in `evals/reports/audio-matrix.json` when run; it must not be substituted for human-reference WER.
- Real local clarification acceptance retained parent facts and created immutable typed/audio versions. Completeness rose 16.67% to 22.22% to 27.78%; evidence coverage rose 0.15 to 0.4 to 0.6. This is one synthetic business/voice example, not an accuracy benchmark or a promised score increase.
- Actual Groq English/Hindi explanations and bounded OSM lookup passed separately. Schema/citation guards do not establish semantic correctness for every explanation.
- Local security/browser tests use labelled synthetic identity/model fixtures where necessary; they are not actual-model quality tests.

## Performance and release boundaries

`docs/SCALABILITY.md` distinguishes the local metadata benchmark from GPU throughput. Model concurrency stays one on the RTX5050 8 GB laptop. Measured cold/warm stage artifacts preserve failures and revisions. Local public-API load does not hit hosted Supabase, model quotas or OSM providers. No public deployment or Hugging Face quota/provisioning claim is supported by these measurements.

Unreviewed OCR, ASR and uncertain translations withhold the headline potential/ranking. A trusted reviewer can verify an exact corrected transcript in a language they understand; this certifies the source rendition, not business truth. Accuracy work should prioritize the failed pages, source amounts, negation, silence/noise and cross-language equivalents, using reviewed family-separated labels before changing models or claiming improvement.
