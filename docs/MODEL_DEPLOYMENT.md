# Owned model runtime and separate hosted target

The working inference target is Kartik's RTX5050 laptop (8,151 MiB reported VRAM), with one GPU stage at a time. It uses a separate Python 3.11 model environment and pinned local snapshots. The API image intentionally contains no model frameworks/weights. This is self-hosted pretrained inference; the project-trained relevance candidate was rejected.

## Existing local configuration

Use `setup.cmd` to explicitly provision missing dependencies/weights, then `start.cmd` to start API, frontend and the narrow outbound worker together. Filled root `.env.local` is preserved. Do not duplicate the model process or reinstall CUDA dependencies while work is running. The launcher passes only worker API URL, identity/credential and optional download token into the worker. Model children do not receive database/service/Groq/signing keys or API capabilities.

The public sources, immutable revisions and licenses are in `models/manifest.json` / `models/PROVENANCE.md`. Model downloads verify hashes against pinned upstream metadata. Inference uses local cached files and no remote-code execution. NLLB is CC-BY-NC-4.0 for this noncommercial prototype. Do not upload private source inputs or gated weights to a host.

## Separate worker installation

The local `owned-worker-source.zip` release artifact includes code, manifest, requirements, provisioning script and narrow worker template, without weights or secrets. Extract preserving the repository layout. Install Python 3.11/uv and the compatible NVIDIA driver; from that root:

```powershell
uv venv .venv-model --python 3.11
uv pip install --python .venv-model/Scripts/python.exe torch==2.9.1 torchvision==0.24.1 --index-url https://download.pytorch.org/whl/cu128
uv pip install --python .venv-model/Scripts/python.exe -r apps/api/requirements.lock -r models/requirements-text.txt
uv pip install --python .venv-model/Scripts/python.exe --no-deps -e apps/api
.venv-model/Scripts/python.exe scripts/download_models.py --artifacts qwen embedding speech speech_odia translation ocr
Copy-Item apps/api/worker.env.example .env.worker.local
```

Review the template privately and fill only the approved API origin and matching worker credential. The existing worker-only file must not be overwritten. The current Windows observed package snapshot is separately recorded; it is environment evidence, not proof of a clean install or Linux/HF compatibility. Provisioning downloads substantial files and requires network/disk; it never uploads input data.

Start the implemented handler against the **actual approved HTTPS API**, without an inbound laptop port:

```powershell
.venv-model/Scripts/python.exe -B -m app.worker --env-file .env.worker.local --handler app.pipeline.run:handler --stages extract:text extract:pdf extract:audio translate structure assess --continuous --stage-seconds 600
```

For entirely local use, prefer `start.cmd`; an explicitly configured loopback API requires `--allow-loopback`. Ctrl+C stops the native worker. Durable per-page/chunk/domain checkpoints and fenced lease generations permit recovery; incompatible manifest output is rejected. Keep previous manifests/code/weights for rollback and never relabel older output as the new policy. Current bounded recovery subdivides capped audio chunks and retries invalid domain judgments once; unresolved judgments remain null with an explicit human-review reason.

## Measurements and limits

Actual English, digital-PDF, typed/audio follow-up, regional chunk and scan checks have separate reports under `evals/reports`. Full regional recordings and initial failures are recorded by `scripts/verify_audio_matrix.py`; inspect its result before claiming a language flow passed. Even a saved assessment is not human-reference accuracy. Unreviewed OCR/ASR/translation withholds headline/ranking. Runtime source lengths, tokens, pages, durations, deadlines and concurrency remain bounded. Two simultaneous Qwen copies do not fit safely within the measured 8 GB budget.

## Hugging Face target remains unverified

The secondary HF/ZeroGPU target is deferred by the hackathon reset. A generic Gradio bridge exists, but no owned Space provisioning, compatible framework installation, model endpoint inference, quota attribution, sleep/quota recovery or public source upload has been verified. No deployable Space directory is claimed to exist. Native Windows package snapshots are not Space manifests. Free-account eligibility alone does not prove usable quota, and two endpoints do not establish independent allowances. Actual account access, supported runtime adaptation and explicit publication approval are required; never add a paid GPU or borrow a public demo to claim completion.
