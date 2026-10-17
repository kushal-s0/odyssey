# Free-runtime feasibility - actual evidence and open gates

## Selected path

Preferred judging configuration: Cloudflare Pages Free static frontend, Render Free lightweight API, Supabase Free auth/Postgres/private storage and an owned-laptop worker. No paid API or trial-credit dependency. The worker uses restricted outbound HTTPS calls; the laptop does not need a public listening port. Cloud account projects are new and not yet provisioned. Publication remains unapproved.

## T01 observed results

| Check | Actual result |
|---|---|
| Dataset inventory and media decode | PASS: 55 files, 109 PDF pages, all 13 recordings decoded; deterministic manifest |
| Hardware | RTX 5050 Laptop GPU, 8151 MiB total VRAM; model fit remains unmeasured |
| Isolated GPU environment | PASS: PyTorch 2.9.1+cu128 / torchvision 0.24.1+cu128; real CUDA matrix multiplication passed on compute capability 12.0 |
| Qwen text/vision config access | PASS: actual config download at pinned revision in model-access manifest; inference is a separate gate |
| MiniLM config access | PASS: actual pinned config download; no embedding inference yet |
| IndicConformer / IndicTrans2 configs | BLOCKED: HTTP 401 GatedRepoError at initial probe; user is configuring read token and accepting conditions |
| Two HF Spaces | NOT PROVISIONED: eligible-account claim is not deployment evidence; account/provisioning/quota and publication approval unresolved |
| Owned-worker callback/recovery | NOT RUN: requires implementation; dataset success does not establish durable execution |

Follow-up: pinned Qwen2B float16 actually ran on the laptop. First/warm synthetic text calls took 8.584/7.389 seconds, returned identical parseable JSON and used about 4.29 GB peak allocated VRAM. A private handwritten page took 39.671 seconds and about 4.34 GB peak allocated VRAM, but exhausted the 192-token output cap. This is successful bounded execution with a needs-review/truncation limitation, not validated handwriting quality. Initial load including uncached download took 376.098 seconds; this is not a pure cold-load benchmark. See evals/reports/feasibility/. The model calculated a derived revenue in the synthetic check; the released pipeline must separate extracted facts from deterministic calculations and require provenance.

See `evals/manifests/model-access.json` for exact repository revisions/licenses and access scope. A config-download success is not a weights-download, model-quality or deployment result.

## Language-identification strategy

Use the [fastText lid.176](https://fasttext.cc/docs/en/language-identification.html) compressed candidate for local text/answer-level language detection; it covers the corpus codes including Odia and Hindi/Marathi. Its weights are CC-BY-SA-3.0, so attribution/license must be retained. Measure short-answer uncertainty and require confirmation instead of trusting script alone. This is a selected strategy, not yet implemented/validated inference.

Regional ASR initially requires a declared/confirmed language code; validate its transcript with text identification and expose disagreements. If the language is absent/uncertain, require confirmation before transcription rather than claiming automatic audio detection. Audio-level LID remains an explicit capability gap until measured. Do not present a selected input language as detected. A larger speech-language model was considered but not adopted without fit/license/latency evidence.

## Reproduce safely

Put optional `HF_TOKEN` in ignored root `.env.local`, after accepting the model access conditions. Never print or commit it. Run `.venv/Scripts/python.exe -B scripts/probe_model_access.py` with network access. The probe records only metadata/config status and safe exception classes/status codes, not credentials.

Downloads use system trust certificates (`truststore`), never disabled TLS verification. The first dependency download failed due to restricted sockets, then certificate trust; retrying with approved network access and system certificates succeeded. Windows cache symlinks are unavailable; regular cache files work with potentially higher disk use.

Free service provisioning, model inference, quality, CUDA operation, memory/latency, guarded Gradio calls, quota attribution and deployed recovery must be individually recorded as checks become available. Never infer them from this architecture document.
