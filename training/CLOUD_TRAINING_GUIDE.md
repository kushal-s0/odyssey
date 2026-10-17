# Run the project training in Google Colab

For the new automated external-data comparison, use **`training/external_cloud_training.ipynb`** and follow [EXTERNAL_DATA.md](EXTERNAL_DATA.md). It downloads QNLI and `isaidchia/sharktank_pitches` automatically, compares an augmented classifier against the target-only baseline, and exports a selected artifact only after checking measured performance. Upload `data/training/reviewed-answers.jsonl` when prompted. The remaining instructions below describe the earlier target-only notebook.

This project trains an answer-relevance classifier: `0 = relevant`, `1 = off-topic`. Hosted Gemini handles document reading, translation, and embeddings. The custom classifier is advisory; it does not predict business success or guarantee factual accuracy.

## Prepared training file

The assistant has prepared `data/training/reviewed-answers.jsonl` from five supplied English PDFs: **48 answers**, **38 relevant**, **10 off-topic**, across **five source families**. Each record includes its source PDF hash, page, original question/answer quotations, and review reason. Labels are assistant-reviewed, not independently expert-validated. Four families have identifiable business types; the form without a stated business stays in one conservative additional family. Off-topic examples cover only two families, so grouped results may be unstable. Blank, overwritten, mixed-language and identifying fields were excluded.

Use this prepared file directly in Colab. It was built from local source PDFs, separately from the labels saved through the app. The app's export button exports only its Atlas labels; it does not include this separately curated file. Avoid replacing the prepared file with an incomplete workspace export.

Rebuild the same source-checked file with `python scripts/build_reviewed_training.py` while the ignored `.planning/assistant-reviewed-decisions.json` and extracted source PDFs are present. This only checks and writes data; it does not train a model or upload source files. Its audit is `.planning/reviewed-training-audit.json`.

## 1. Prepare reviewed answers in the app

`reviewed-answers.jsonl` is not included with the raw dataset. It is generated from labels you review and save in the app. Use the export button for a browser download, or the export command below to create it under `data/training/` in this project. An empty export cannot be used for training.

1. Sign in at http://localhost:5173 using the assessor credentials in the root `.env`.
2. Open processed dataset submissions and compare their extracted answers with the original PDFs. Check transcription/translation before labelling.
3. Open **Model & training**, select a submission and an answer with source evidence, and enter its underlying business family.
4. Label the answer **Relevant** when it answers the selected question, or **Off-topic** when it does not. An unrealistic business forecast can still be relevant to the revenue question. Blank answers are missing information, not automatically off-topic examples.
5. Save each reviewed label. Use the same family ID for translations, revisions, and scenarios of the same underlying business; changing language does not make an independent group.

Training requires at least **20 reviewed answers**, **four independent business families**, and **five answers in each class**. These are minimum checks, not proof that the dataset is statistically sufficient. Four uploaded PDFs do not necessarily represent four independent families. Do not manufacture off-topic labels or use synthetic interface examples to pass the checks.

Click **Export reviewed answers** to download `reviewed-answers.jsonl`. Alternatively, run `npm.cmd run training:export` from the repository root; its output is `data/training/reviewed-answers.jsonl`. This command exports labels without training locally.

## 2. Upload the notebook

1. Open https://colab.research.google.com/ and sign in to Google.
2. Choose **File → Upload notebook** and select `training/cloud_training.ipynb` from this project.
3. Use **Connect** to attach a Google-hosted runtime. CPU is enough for this classifier; no GPU is required. Do not choose a local runtime.

The notebook contains the training script, so a GitHub repository or Drive mount is not needed.

## 3. Run the cells from top to bottom

1. Run the first code cell. It installs NumPy, Requests, and scikit-learn, then opens a file chooser.
2. Upload exactly one `reviewed-answers.jsonl` file. It needs reviewed answer records, not the raw PDF/audio archive.
3. Run the next code cell to define the training functions, then the `check_training_file(paths[0])` cell. It reports the actual answer, family, and class counts before any model requests.
4. Run the following training cell. Enter only your `GEMINI_API_KEY` at its hidden prompt. Do not upload `.env`, your MongoDB URI, or the Sarvam key.
5. The `artifact = train(paths[0], api_key)` call obtains hosted 768-dimensional embeddings, trains logistic regression in Colab, and evaluates with business families kept apart across folds.
6. Inspect the printed results and `evaluation.json`: group/class counts, evaluation coverage, macro-F1, off-topic recall, confusion matrix, and abstention rate. Small-data estimates are experimental; report the measured results even if they are weak.
7. Run the final download cell and allow the browser to download all three output files:
   - `model.json`: actual trained coefficients and metadata.
   - `evaluation.json`: measured evaluation results.
   - `parity-vectors.json`: inputs and expected outputs for checking the deployed service.

Download before disconnecting; files in a Colab runtime are temporary. Keep participant content and API keys out of shared notebook outputs.

## 4. Connect the trained model to the app

After training, deploy `model-service` to a remote Node host using the instructions in `README.md`. Upload the trained artifact through the host's private secret-file mechanism. Configure `REMOTE_MODEL_RUNTIME=true`, `MODEL_ARTIFACT_PATH`, and a private `MODEL_SERVICE_TOKEN` on that host. Configure its URL and matching token as `MODEL_SERVICE_URL` and `MODEL_SERVICE_TOKEN` in the main application.

Verify the deployed predictions against `parity-vectors.json`, then check **Model & training** for the model's real version and evaluation metrics. The app's extraction and rubric work without the custom classifier, but classifier training and deployment remain incomplete until these steps succeed.

## Common stops

- **Need at least 20 reviewed answers…**: add genuine reviewed labels/families in the app and export again.
- **Old upload still fails the minimum checks**: rerun the upload cell and select the newly prepared 48-row JSONL file. An earlier upload stays unchanged when a local file is updated. Re-upload the updated notebook too if you want its new count check before training.
- **HTTP 429 / embedding quota…**: wait for the provider quota to recover, then rerun the training cell. Do not replace failed embeddings with fabricated vectors.
- **HTTP 400 / model unavailable**: confirm that the embedding model matches the model configured in the main app. The default is `gemini-embedding-001` with 768 dimensions.
- **No valid grouped evaluation folds**: inspect the label distribution across business families; do not split translations into separate families to inflate results.

Colab upload/runtime guidance: https://research.google.com/colaboratory/faq.html
