FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models/huggingface HF_HUB_DISABLE_TELEMETRY=1 TOKENIZERS_PARALLELISM=false CUDA_VISIBLE_DEVICES=""
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 libgomp1 poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin tesseract-ocr-mar tesseract-ocr-tel tesseract-ocr-ben tesseract-ocr-ori && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu && python -m pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 10001 strive && mkdir -p /models/huggingface && chown -R strive:strive /models /app
COPY --chown=strive:strive gateway.py healthcheck.py ./
USER strive
EXPOSE 8080
CMD ["python", "-m", "uvicorn", "gateway:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
