#!/usr/bin/env bash
# Cloud-only foreground launcher. Ctrl+C stops both owned processes.
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ "$(uname -s)" != Linux ]] || ! command -v nvidia-smi >/dev/null; then
  echo "Start this only on your Linux NVIDIA cloud server." >&2; exit 1
fi
if [[ ! -x .venv-llm/bin/vllm || ! -x .venv-gateway/bin/python ]]; then
  echo "Run the cloud setup script first." >&2; exit 1
fi
# Read dotenv as data; never execute a secret file as shell commands.
eval "$(.venv-gateway/bin/python - <<'PY'
import shlex
from pathlib import Path
allowed={'CLOUD_SERVICE_TOKEN','HF_TOKEN'}
for line in Path('.env').read_text().splitlines():
    key, separator, value=line.partition('=')
    if separator and key.strip() in allowed:
        print('export '+key.strip()+'='+shlex.quote(value.strip().strip('\"').strip("'")))
PY
)"
: "${HF_TOKEN:?Set HF_TOKEN after accepting the speech model access conditions}"
: "${CLOUD_SERVICE_TOKEN:?Set a private cloud service token}"
if (( ${#CLOUD_SERVICE_TOKEN} < 32 )); then echo "Use a service token of at least 32 characters." >&2; exit 1; fi
export VLLM_API_KEY="$CLOUD_SERVICE_TOKEN"
export HF_HUB_DISABLE_TELEMETRY=1 TOKENIZERS_PARALLELISM=false
export INDIC_MODEL_REVISION=2a77d305038dfc502fd9464e7d028b90381976cb
export LLM_URL=http://127.0.0.1:8000 ASR_CPU_THREADS=4
llm_pid='' gateway_pid=''
cleanup() {
  [[ -z "$gateway_pid" ]] || kill "$gateway_pid" 2>/dev/null || true
  [[ -z "$llm_pid" ]] || kill "$llm_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
.venv-llm/bin/vllm serve Qwen/Qwen3.5-9B \
  --revision c202236235762e1c871ad0ccb60c8ee5ba337b9a \
  --served-model-name Qwen/Qwen3.5-9B --host 127.0.0.1 --port 8000 \
  --language-model-only --max-model-len 16384 --max-num-seqs 1 \
  --gpu-memory-utilization 0.90 --disable-log-requests &
llm_pid=$!
CUDA_VISIBLE_DEVICES='' .venv-gateway/bin/python -m uvicorn gateway:app \
  --host 127.0.0.1 --port 8080 --workers 1 --no-access-log &
gateway_pid=$!
wait -n "$llm_pid" "$gateway_pid"
