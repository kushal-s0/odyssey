# Dataset inventory and feasibility

## What the code does

`scripts/inventory_dataset.py` opens the original ZIP archives in memory without extracting their paths. Each file gets a SHA-256 identity. PDF inspection records page geometry, per-page extracted-text hashes and scan candidates. Audio inspection uses PyAV/FFmpeg to inspect real streams and optionally decode every frame. Decoding is stronger evidence than trusting a file extension or a container duration alone.

`inventory()` returns two documents. The versioned manifest in `evals/manifests/dataset.json` contains opaque IDs and technical metadata. The ignored `.local/dataset-manifest.private.json` maps IDs back to source paths and contains extracted text. Personal data and source text must not enter public model repositories, frontend bundles or published evaluation reports.

`family_hint()` produces conservative grouping suggestions. They are not reviewed labels. Related/translated scenario variants must be grouped together before train/validation/test splitting; file hashes alone cannot prevent semantic leakage. The recordings are deliberately grouped as unreviewed until their content is checked.

## Reproduce

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe -r scripts/requirements-inspect.txt
.venv/Scripts/python.exe -B scripts/inventory_dataset.py --decode-audio
```

The tool exits nonzero if an entry cannot be inspected. Metadata inspection does not establish transcription accuracy, language quality or successful model inference. English and Hindi review is available; other languages remain unvalidated.

## Feasibility decision

The preferred free judging route uses hosted web/API/private persistence and a laptop worker. The laptop avoids provider inference quotas, but its observed 8 GB VRAM is not proof that the selected models fit. T01 must separately measure actual execution, resource use, model access and recovery. HF provisioning/quota is separate evidence and must never be inferred from laptop results.
