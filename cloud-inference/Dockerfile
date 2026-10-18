# Build/run only on the cloud server, never as part of npm install/dev/build.
FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1 HF_HOME=/models/hf HF_HUB_DISABLE_TELEMETRY=1 TOKENIZERS_PARALLELISM=false
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 libgomp1 ffmpeg poppler-utils tesseract-ocr \
    tesseract-ocr-eng tesseract-ocr-hin tesseract-ocr-mar \
    tesseract-ocr-tel tesseract-ocr-ben tesseract-ocr-ori \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
RUN useradd -u 10001 -m service && mkdir -p /models/hf && chown -R service:service /models
COPY gateway.py .
USER service
EXPOSE 8080
CMD ["uvicorn", "gateway:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
