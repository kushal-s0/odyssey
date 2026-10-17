# Sources, licenses and provenance

| Resource | Use | Provenance / constraint |
|---|---|---|
| Organizer's three original archives and problem statement | Private development/evaluation inputs | Preserve original bytes; no redistribution permission established; do not publish beneficiary data |
| [Qwen3-VL-2B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct) | Candidate pretrained text/vision model | Apache-2.0; model revision and actual access recorded by probe; not project-trained |
| [IndicConformer 600M](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) | Candidate pretrained regional ASR | MIT; gated download conditions require account acceptance; not project-trained |
| [IndicTrans2 Indic-English](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M) and [English-Indic](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M) | Candidate pretrained translation | MIT; access conditions must be accepted; not project-trained |
| [MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | Candidate frozen English embeddings | Apache-2.0; respect input truncation; not project-trained |
| PyAV / FFmpeg | Local media stream inspection/decoding | PyAV BSD; bundled FFmpeg build has its own license/configuration; retain applicable distribution notices |
| pypdf | Local PDF inspection | BSD-3-Clause; text extraction is not proof of handwriting recognition |
| [py3langid 0.3.0](https://github.com/adbar/py3langid) | Local language identification with explicit declared-language fallback | BSD-3-Clause fork of langid.py; packaged detector scores are not calibrated quality confidence; no script-only Hindi/Marathi inference |

No additional public dataset has been incorporated yet. If added, record URL, publisher, retrieval date/version/hash, license, transformations, allowed redistribution, personal-data handling and evaluation split. Keep synthetic or machine-labeled examples distinct from human-reviewed real evaluation. Do not conceal third-party resources or make unsupported originality claims.

## Local T07 test tooling (17 October 2026)

- [PostgreSQL Windows binaries](https://www.enterprisedb.com/download-postgresql-binaries):
  EDB PostgreSQL 16.15-1 x64 ZIP, PostgreSQL license and bundled notices retained
  under ignored `.local/native-postgres/pgsql`; not a deployed/release artifact.
- [pgvector v0.8.1](https://github.com/pgvector/pgvector/tree/v0.8.1): official
  source ZIP, license retained with source under ignored `.local/vector-build`.
  Built locally against EDB headers/import library. A local `pg_strtof` shim
  calls MinGW's C99 `strtof` because the MSVC-configured header references an
  unavailable symbol. `-mcmodel=large` avoids cross-module pseudo-relocation
  failures. The first native extension build failed and was repaired before
  migrations/tests passed. This adapted native build is test infrastructure,
  not a validated release package; keep the pinned Docker profile for portability.
- [w64devkit 2.5.0](https://github.com/skeeto/w64devkit/releases/tag/v2.5.0):
  portable x64 compiler/toolchain extracted under ignored `.local/compiler-build`;
  retain its bundled component license notices. No global compiler installation.
- [Gradio enqueue protocol](https://gradio.app/4.44.1/guides/querying-gradio-apps-with-curl):
  adapter design reference. Simulated transport is not hosted enqueue/quota proof;
  no unlimited/private-Space quota claim is adopted from this guide.

- [pypdfium2 5.14.0](https://pypi.org/project/pypdfium2/5.14.0/): pinned worker-only PDF rendering, Apache-2.0/BSD-3-Clause wrapper plus bundled PDFium/dependency notices retained in installed wheels. [Official API](https://pypdfium2.readthedocs.io/en/stable/python_api.html). Rendering and OCR run locally; private pages are never sent to a model API.
