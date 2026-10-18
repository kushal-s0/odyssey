#!/usr/bin/env bash
# Run only on your Linux CLOUD GPU server. Never executed by npm or on the dev PC.
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ "$(uname -s)" != Linux ]] || ! command -v nvidia-smi >/dev/null; then
  echo "Use a Linux cloud VM with a working NVIDIA GPU driver." >&2; exit 1
fi
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Fill cloud-inference/.env on this cloud server, then rerun this script."; exit 1
fi
python3 - <<'PY'
import os
from pathlib import Path
# A marker prevents accidental model installation on a normal development machine.
if os.environ.get('STRIVE_CLOUD_SETUP') != 'yes':
    raise SystemExit('Run STRIVE_CLOUD_SETUP=yes bash setup_cloud.sh on the cloud server.')
PY
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip ffmpeg libsndfile1 libgomp1 poppler-utils \
  tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin tesseract-ocr-mar \
  tesseract-ocr-tel tesseract-ocr-ben tesseract-ocr-ori
python3 -m venv .venv-llm
.venv-llm/bin/python -m pip install --upgrade pip
.venv-llm/bin/python -m pip install 'vllm==0.31.0'
python3 -m venv .venv-gateway
.venv-gateway/bin/python -m pip install --upgrade pip
.venv-gateway/bin/python -m pip install torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu
.venv-gateway/bin/python -m pip install -r requirements.txt
echo "Python environments are ready. Start with: bash start_cloud.sh"
