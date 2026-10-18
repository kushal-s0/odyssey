# Qwen3.5-9B with Docker on a remote CPU server

This is the original Qwen3.5-9B model, using the pinned [Unsloth Q4_K_M GGUF conversion](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF) from Hugging Face through CPU-only llama.cpp. It does not substitute the smaller 1.7B model. No NVIDIA GPU or driver is required. Docker provides packaging; it does not provide hosting or make compute free.

Run this on a **remote Linux CPU server**, respecting the requirement that models do not run on your development computer. No containers, models, or deployments have been started here. Docker is not installed in the current development environment, so an actual image build and model startup remain unverified.

Plan for **24 GB RAM, 6+ CPU cores and 40 GB free disk** for generation plus speech/OCR. This is a conservative planning estimate, not a measured requirement. CPU generation and audio can take minutes. Tiny free web-hosting instances cannot run this complete package.

## 1. Configure the remote server

Install Docker Engine and the Compose plugin using the [official Linux instructions](https://docs.docker.com/engine/install/). Copy only the `cloud-inference` folder to that server; keep participant records and the MERN root `.env` off it.

In `cloud-inference/.env`, set:

```dotenv
CLOUD_SERVICE_TOKEN=your-separate-random-secret-at-least-32-characters
HF_TOKEN=hf_your_read_token
```

Get a read token at [Hugging Face tokens](https://huggingface.co/settings/tokens). Accept access to [IndicConformer](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) with the same account. HF_TOKEN is needed for gated speech weights; Qwen's GGUF is public. Never commit or share these secrets.

## 2. Build and start

In the remote server terminal:

```bash
cd cloud-inference
export STRIVE_CLOUD_SETUP=yes
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=40 gateway
```

`config --quiet` validates without printing interpolated secrets. The first build compiles a pinned llama.cpp CPU server and installs CPU speech/OCR dependencies. First startup downloads approximately 6 GB of Qwen weights plus speech weights; allow time for downloads and initialization. Health checks stay unready until generation and speech are ready. A failed health check alone does not restart containers.

The two services are:

- `llm`: Qwen3.5-9B Q4_K_M generation on CPU. Model URL and llama.cpp source commit are pinned. One request runs at a time; thinking is disabled. No host port is published.
- `gateway`: authenticated generation, pypdf/Tesseract OCR in all six input languages, and the existing CPU speech models (IndicConformer for five regional languages, Whisper for English). Qwen is the only generative language model; dedicated speech tools remain necessary for recordings.

Secrets are injected at runtime and excluded from the Docker build context. Model caches use named volumes. Containers run without root, with dropped Linux capabilities. The gateway is bound only to the cloud host's `127.0.0.1:8080`.

## 3. Connect the MERN app

On your development computer, keep this SSH tunnel open:

```bash
ssh -N -L 8080:127.0.0.1:8080 your-user@your-cloud-host
```

Set the MERN project's root `.env`:

```dotenv
CLOUD_AI_URL=http://127.0.0.1:8080
CLOUD_AI_TOKEN=the-same-CLOUD_SERVICE_TOKEN
CLOUD_AI_MODEL=Qwen/Qwen3.5-9B
CLOUD_AI_TIMEOUT_MS=930000
```

Restart MERN with `npm.cmd run dev`, then run:

```powershell
npm.cmd run check:cloud
```

This checks authenticated readiness, strict JSON, a synthetic selectable PDF and generated silence; it does not upload participant files or demonstrate real speech accuracy. CPU requests can wait up to 15 minutes in the gateway; the app's timeout is slightly longer. The durable processing queue continues heartbeating while waiting. Short inputs work best. Inputs exceeding the 16K context fail explicitly instead of being silently truncated.

## Stop, restart and troubleshoot

```bash
docker compose logs --tail=60 gateway
docker compose ps
docker compose down
# Later, with STRIVE_CLOUD_SETUP=yes still exported:
docker compose up -d
```

`down` retains cached models. Do not add `-v` unless you intend to remove them. LLM request logs are disabled to avoid retaining submitted evidence. Use container status and the gateway readiness check to diagnose generation startup. If speech initialization fails, verify HF access and server memory. If the gateway rejects access, check that both service tokens match and contain at least 32 characters. A host port conflict on 8080 must be resolved before startup.

Strict schema validation, quotation/page checks, numeric checks and refusal of incomplete output remain active. These reduce unsupported output but cannot guarantee factual accuracy. Quantization and CPU performance need a real multilingual evaluation; no improvement in accuracy or throughput is claimed. Cloud mode exclusively uses this service, with no silent Gemini/Groq/Sarvam fallback. To restore the existing providers, clear `CLOUD_AI_URL` and restart MERN.

The older `setup_cloud.sh` and `start_cloud.sh` files remain an optional native **GPU** path. They are not used by this Docker CPU setup.
