# External data and automated cloud comparison

Use `training/external_cloud_training.ipynb` in a **hosted Google Colab runtime**. Choose **Runtime → Run all**. Upload only `data/training/reviewed-answers.jsonl` (48 prepared target answers) when prompted; an existing private `embedding_cache.json` is optional. Give the Gemini embedding key through Colab Secrets named `GEMINI_API_KEY`, or the hidden prompt. Groq continues to handle app generation fallback; it cannot replace the embeddings used by this classifier.

The notebook is self-contained. It installs its Python dependencies, downloads pinned public data, checks source hashes, prepares auxiliary rows, caches hosted embeddings, trains two classifiers, compares them on the same held-out business families, and downloads `strive-cloud-training-results.zip`. It starts no deployment. No model training or inference runs on your computer.

Prepared data:

| Source | Training | Separate validation/test | Meaning |
| --- | ---: | ---: | --- |
| Your source-reviewed business answers | 48 | Grouped out-of-fold by business family | Relevant/off-topic; assistant-reviewed, not independent expert ground truth |
| [SetFit/qnli](https://huggingface.co/datasets/SetFit/qnli) | 600 | 120 | Business/economics question–sentence pairs; contains-answer versus does-not-contain-answer |
| [isaidchia/sharktank_pitches](https://huggingface.co/datasets/isaidchia/sharktank_pitches) | 122 pairs / 30 companies | 40 pairs / 10 companies | Positive-only structured product, persona, problem and differentiation fields |

Counts can decrease when overlap with target answers is removed. The original 196/49 Shark Tank train/test records contain no explicit relevance negatives, readiness scores or business-success outcomes. The adapted positive answers retain their source field, row ID and exact structured value. Structured values are often paraphrases of the pitch transcript; they are not presented as transcript quotations unless an exact match exists. Investment asks are not converted into setup cost or revenue labels. Shark Tank test results report relevant-answer retention and false off-topic flags; a positive-only test cannot measure off-topic recall.

QNLI is auxiliary supervision: “does not contain an answer” can still be about the same topic. Its filter selects business/economics keywords in the question only. It is not entrepreneurship outcome data. Shared questions or answer sentences form connected groups. Official validation rows are kept separate and overlapping questions/answers are excluded. Shark Tank companies remain together and official test companies never become training companies. External examples never count as reviewed target labels.

The default run uses roughly 930 hosted embedding requests before deduplication/cache reuse. Free quotas may interrupt it; the runtime preserves its cache after each successful call. Resume in the same runtime or privately download the cache before disconnecting and upload it with the target JSONL next time. Do not share participant embeddings or keys in public notebook outputs.

`comparison.json` reports target-only baseline and external-data candidate metrics separately, plus separate QNLI validation and Shark Tank positive-only test results. External sample weights keep their total influence bounded. `model.json` contains the selected classifier. The candidate is recommended only when target grouped-CV coverage is complete, macro-F1 improves by at least 0.02, off-topic recall and precision do not decrease, and at least three high-threshold flags have at least 80% observed precision. Otherwise the baseline remains selected; the candidate is still exported for inspection.

This is an experimental development comparison with only five target families. It is not an independent final test and cannot guarantee better accuracy, business success, funding suitability, factual correctness or regional-language quality. Keep the current trained model until the new run produces evidence of improvement. The app's score remains a deterministic evidence/readiness rubric; training improves only the advisory answer-relevance classifier.

Attribution and source versions:

- QNLI: `SetFit/qnli`, revision `e08ed8239c319cf7f2d2ab393d1b90e276c39570`. [Pinned card](https://huggingface.co/datasets/SetFit/qnli/blob/e08ed8239c319cf7f2d2ab393d1b90e276c39570/README.md). QNLI is derived through [GLUE](https://huggingface.co/datasets/nyu-mll/glue#qnli) from [SQuAD](https://rajpurkar.github.io/SQuAD-explorer/), whose authors state CC BY-SA 4.0. Retain upstream attribution and applicable ShareAlike terms for redistributed adapted data. The SetFit card does not declare a separate license.
- Shark Tank: `isaidchia/sharktank_pitches`, revision `3ccc6b50b06a93d7cb68a55f7baf8391fd3431b8`. [Pinned publisher card](https://huggingface.co/datasets/isaidchia/sharktank_pitches/blob/3ccc6b50b06a93d7cb68a55f7baf8391fd3431b8/README.md), MIT declaration. Preserve attribution; these public pitch examples are auxiliary data, not real submissions to this application.

Prepared JSONL files and downloaded caches are ignored by Git. Manifests retain exact source/prepared SHA256 values and selection details. Rebuild data without running a model:

```powershell
python training/external_data.py
python training/sharktank_data.py
python scripts/build_external_notebook.py
```
