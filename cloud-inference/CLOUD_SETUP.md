# Prepare your own cloud inference

The app can use models on your own cloud server for text extraction/translation, PDF reading/OCR and audio transcription. This removes Gemini/Groq/Sarvam inference quotas from that path. It still uses a private HTTP API between MERN and your server, and cloud compute is not free. Nothing in this package starts during `npm install`, `npm run dev` or `npm run build`.

**Prepared, not deployed:** the integration and HTTP/PDF contracts are tested without loading models. GPU boot, memory use, real ASR/OCR accuracy, throughput and all six language-quality checks still need validation on the actual cloud machine. No model weights were downloaded to this computer. Existing hosted API settings remain active until you configure the new address.

## Model choices

| Task | Cloud component | Why / limitation |
| --- | --- | --- |
| Extract facts and translate source passages | [Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B), served by [vLLM](https://docs.vllm.ai/en/v0.31.0/features/structured_outputs/) | Open weights, Apache-2.0; structured JSON decoding. The publisher reports broad multilingual support; this does not establish accuracy on your dataset. Thinking is disabled; the existing schema, quotations, page references and numeric checks remain required. |
| Hindi, Marathi, Telugu, Bengali, Odia speech | [AI4Bharat IndicConformer 600M multilingual](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) | MIT model with all five regional input languages, including Odia (`or`). Its files are gated: accept access conditions in your own HF account. This package pins the revision because the model uses custom Python code. |
| English speech | [faster-whisper](https://github.com/SYSTRAN/faster-whisper), small model | CPU inference on the cloud VM; voice-activity filtering and no previous-chunk text conditioning. This is a functional starting point, not a measured accuracy improvement. |
| PDFs | pypdf + cloud Poppler/Tesseract OCR | Selectable text is kept by page; scanned pages use the six installed OCR languages. Unreadable/blank pages stop processing. Handwriting needs a clearer source or human correction. OCR citations match OCR text, not independently verified pixels. |

The smaller ASR models run on the cloud CPU; only vLLM receives the GPU. This avoids competing GPU allocations. All speech is marked unverified. Single-speaker recordings and an explicit input-language selection are required. Audio is decoded into existing 25-second mono WAV chunks; timestamps are approximate chunk boundaries. Silence and strongly repetitive output are withheld, but these checks cannot guarantee perfect transcription.

## Three steps when you choose to deploy

1. **Prepare the cloud VM.** Use Linux with NVIDIA Container Toolkit and Docker Compose GPU support. Start with an NVIDIA GPU with **32 GB or more VRAM**, 8 CPU cores, 32–64 GB RAM and about 80 GB disk. These are planning estimates for a 9B BF16 model with a 16K context and one concurrent generation; actual requirements must be measured. A free 16 GB Colab session is not a reliable fit for this configuration and is not persistent hosting.

   Copy only `cloud-inference/` to the cloud machine. No dataset upload is needed to boot. On Hugging Face, accept the IndicConformer access conditions and create a read-only token. Copy `.env.example` to `.env` **inside the cloud folder**, generate a separate random 32+ character `CLOUD_SERVICE_TOKEN`, and put the HF token in `HF_TOKEN`. Keep these out of chat and Git. The model gate asks to share your HF contact information with its owner; this is done through HF, not automatically by this project.

2. **Start the cloud service yourself.** From that folder, run:

   ```bash
   docker compose --env-file .env up -d --build
   ```

   This command has **not** been run by Codex. It downloads model weights on the cloud VM. First initialization can take several minutes. vLLM is internal-only; the authenticated gateway binds to the VM's loopback port 8080. Use an SSH tunnel from the MERN API machine, or your existing private network/TLS proxy. Do not publish the raw GPU engine. Example tunnel:

   ```bash
   ssh -N -L 8080:127.0.0.1:8080 your-user@your-cloud-host
   ```

   The gateway authenticates before parsing request bodies, bounds uploads, serializes generation/PDF work, keeps temporary originals only for a request and suppresses access logs. Model code and tokenizer files are downloaded from HF during initialization. Participant data is sent only to this private service; the service does not call a hosted inference provider. Persistent volumes contain model assets, not uploaded participant originals.

3. **Connect MERN after readiness passes.** In the project's existing root `.env`, set:

   ```dotenv
   CLOUD_AI_URL=http://127.0.0.1:8080
   CLOUD_AI_TOKEN=the-same-private-service-token
   CLOUD_AI_MODEL=Qwen/Qwen3.5-9B
   ```

   The loopback URL above assumes the SSH tunnel is on the API machine. Use HTTPS for a public address. Restart the MERN API yourself. A nonempty `CLOUD_AI_URL` selects exclusive cloud generation, PDF and speech processing. It also bypasses saved Gemini/Groq cooldowns. The old keys may remain in `.env` for rollback but are not called by this path. Never silently fall back to an external provider when the private service fails.

   Run `npm.cmd run check:cloud`. It checks authenticated readiness, strict JSON, a synthetic selectable PDF and generated silence, without reading participant records. Then submit one reviewed example per language and format, compare all accepted facts with the originals, and measure transcription/numeric fidelity before processing the rest of the dataset.

## Expected differences

- Remote Qwen produces the same source/field schemas. Node still checks every accepted quoted value and citation. Numeric translation drift is withheld. Readiness and financial scores remain deterministic; model output cannot choose a score.
- A cloud OCR result stays explicitly unverified and links back to the uploaded original. Human review remains necessary for ambiguous or overwritten answers.
- External Gemini embeddings are disabled in cloud mode, so the app uses keyword-related ideas. The old cloud-trained relevance classifier uses Gemini embeddings and will remain unavailable in this mode. Replacing its embeddings requires separate cloud retraining and evaluation; incompatible vectors are never substituted.
- Quota is replaced by finite server capacity. Busy responses use bounded waits and the durable queue/checkpoints. One API worker and one GPU generation at a time are the starting configuration.
- No automatic retries of existing participant records, billing changes, VM creation, port publishing or deployment occur when you edit these files. Start with the synthetic check, then explicitly retry a selected record.

To roll back, clear `CLOUD_AI_URL` and restart the API. Existing source records and scores remain in Atlas.

## Verification before operational use

The prepared image pins vLLM and the two critical Qwen/IndicConformer revisions. The gateway's dependency ranges should be resolved and locked after the first successful cloud build. GPU driver compatibility, model custom-code compatibility and gated downloads cannot be established by local unit tests. Test those before treating the service as ready; `/health/ready` returns 503 until both generation and speech are ready.

Review a small held-out set in all six languages with a fluent reviewer, especially Odia, code-switching, money amounts and handwriting. Do not promise that self-hosting raises accuracy: it changes availability and who operates inference. Keep the better result only after a fair comparison on the same reviewed cases.
