"""Private cloud-only inference gateway. Importing this module never loads a model."""
import asyncio
import base64
import hmac
import io
import json
import logging
import os
import subprocess
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from jsonschema import Draft202012Validator, SchemaError, ValidationError
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

TOKEN = os.environ.get("CLOUD_SERVICE_TOKEN", "")
LLM_URL = os.environ.get("LLM_URL", "http://127.0.0.1:8000").rstrip("/")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT_SECONDS", "145"))
MAX_FILE = 12 * 1024 * 1024
asr_lock = threading.Lock()
speech = {"indic": None, "english": None, "ready": False}


def authorized(authorization: str = Header(default="")):
    if len(TOKEN) < 32 or not hmac.compare_digest(authorization, "Bearer " + TOKEN):
        raise HTTPException(401, "Private service authentication required")


def load_speech():
    # These packages and model files exist only in the cloud Python environment.
    import torch
    from transformers import AutoModel
    from faster_whisper import WhisperModel
    torch.set_num_threads(int(os.environ.get("ASR_CPU_THREADS", "4")))
    speech["indic"] = AutoModel.from_pretrained(
        "ai4bharat/indic-conformer-600m-multilingual",
        revision=os.environ["INDIC_MODEL_REVISION"],
        trust_remote_code=True, token=os.environ.get("HF_TOKEN"),
    )
    speech["english"] = WhisperModel("small", device="cpu", compute_type="int8")
    speech["ready"] = True


async def initialize_speech():
    try:
        await asyncio.to_thread(load_speech)
    except Exception:
        # Never log the exception body: download URLs can carry credentials.
        logging.error("Speech initialization failed. Check model access, package versions and cloud memory.")


@asynccontextmanager
async def lifespan(_app):
    if len(TOKEN) < 32:
        raise RuntimeError("Set a cloud service token of at least 32 characters")
    task = asyncio.create_task(initialize_speech())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def guard(request, call_next):
    if len(TOKEN) < 32 or not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + TOKEN):
        return JSONResponse({"detail": "Private service authentication required"}, status_code=401)
    if request.method == "POST":
        try:
            length = int(request.headers.get("content-length", "-1"))
        except ValueError:
            length = -1
        if length < 0 or length > 20 * 1024 * 1024:
            return JSONResponse({"detail": "A bounded request body is required"}, status_code=413)
    return await call_next(request)


@app.get("/health/ready", dependencies=[Depends(authorized)])
async def ready():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(LLM_URL + "/health")
        llm = response.status_code == 200
    except httpx.HTTPError:
        llm = False
    if not llm or not speech["ready"]:
        raise HTTPException(503, "Model initialization is not complete")
    return {"ready": True, "generation": True, "speech": True, "ocr": True}


class ChatRequest(BaseModel):
    model: str
    messages: list[dict] = Field(min_length=1, max_length=4)
    response_format: dict
    max_tokens: int = Field(default=8192, ge=1, le=8192)
    temperature: float = Field(default=0, ge=0, le=0)
    chat_template_kwargs: dict = Field(default_factory=lambda: {"enable_thinking": False})


generation_lock = asyncio.Lock()


@app.post("/v1/chat/completions", dependencies=[Depends(authorized)])
async def chat(body: ChatRequest):
    if body.model != "Qwen/Qwen3.5-9B" or body.response_format.get("type") != "json_schema":
        raise HTTPException(422, "The configured model and strict schema are required")
    if body.response_format.get("json_schema", {}).get("strict") is not True:
        raise HTTPException(422, "Strict schema is required")
    schema = body.response_format["json_schema"].get("schema")
    if not isinstance(schema, dict) or not schema:
        raise HTTPException(422, "A nonempty JSON schema is required")
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError:
        raise HTTPException(422, "Invalid JSON schema")
    if len(str(body.messages)) > 150000:
        raise HTTPException(413, "Input is too long")
    if generation_lock.locked():
        raise HTTPException(429, "Cloud generation is busy", headers={"Retry-After": "10"})
    async with generation_lock:
        payload = body.model_dump()
        payload["chat_template_kwargs"] = {"enable_thinking": False}
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                response = await client.post(LLM_URL + "/v1/chat/completions", json=payload,
                    headers={"Authorization": "Bearer " + TOKEN})
            if response.status_code != 200:
                status = response.status_code if response.status_code in (400, 413, 422, 429, 503) else 503
                raise HTTPException(status, "Cloud generation could not complete", headers={"Retry-After": "30"})
            result = response.json()
            choice = result["choices"][0]
            if choice.get("finish_reason") != "stop" or choice["message"].get("refusal"):
                raise HTTPException(422, "Incomplete generation was withheld")
            value = json.loads(choice["message"]["content"])
            # Constrained decoding does not replace output validation.
            Draft202012Validator(schema).validate(value)
            return result
        except (ValidationError, json.JSONDecodeError, KeyError, IndexError, TypeError):
            raise HTTPException(422, "Invalid structured generation was withheld")
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "Cloud generation is temporarily unavailable", headers={"Retry-After": "30"})


class PdfRequest(BaseModel):
    pdfBase64: str = Field(min_length=1, max_length=17 * 1024 * 1024)


def pdf_text(raw: bytes):
    from pypdf import PdfReader
    from PIL import Image
    import pytesseract
    if len(raw) > MAX_FILE or not raw.startswith(b"%PDF-"):
        raise HTTPException(422, "Upload a PDF within the size limit")
    pages, ocr_pages, characters = [], [], 0
    try:
        document = PdfReader(io.BytesIO(raw), strict=True)
        if document.is_encrypted or not 1 <= len(document.pages) <= 25:
            raise HTTPException(422, "Use an unlocked PDF with at most 25 pages")
        with tempfile.TemporaryDirectory(prefix="strive-cloud-pdf-") as directory:
            original = Path(directory) / "original.pdf"
            original.write_bytes(raw)
            for index, page in enumerate(document.pages, 1):
                text = (page.extract_text() or "").strip()
                if len("".join(text.split())) < 20:
                    output = Path(directory) / f"page-{index}"
                    subprocess.run(["pdftoppm", "-f", str(index), "-l", str(index), "-singlefile",
                        "-scale-to", "2000", "-png", str(original), str(output)],
                        check=True, capture_output=True, timeout=30)
                    with Image.open(str(output) + ".png") as image:
                        text = pytesseract.image_to_string(image, lang="eng+hin+mar+tel+ben+ori", timeout=30).strip()
                    ocr_pages.append(index)
                if len("".join(text.split())) < 20:
                    raise HTTPException(422, "An unreadable or blank page requires a clearer document")
                characters += len(text)
                if characters > 100000:
                    raise HTTPException(413, "Split this PDF into shorter documents")
                pages.append({"page": index, "text": text})
        return {"pages": pages, "ocrPages": ocr_pages}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "PDF extraction failed; provide a clearer unlocked document")


pdf_lock = asyncio.Lock()


@app.post("/v1/documents/text", dependencies=[Depends(authorized)])
async def read_pdf(body: PdfRequest):
    if pdf_lock.locked():
        raise HTTPException(429, "PDF processing is busy", headers={"Retry-After": "10"})
    try:
        raw = base64.b64decode(body.pdfBase64, validate=True)
    except ValueError:
        raise HTTPException(422, "Invalid PDF encoding")
    async with pdf_lock:
        return await asyncio.to_thread(pdf_text, raw)


def speech_text(raw: bytes, language: str):
    import numpy as np
    import soundfile as sf
    import torch
    samples, rate = sf.read(io.BytesIO(raw), dtype="float32")
    if rate != 16000 or samples.ndim != 1 or len(samples) > 26 * 16000:
        raise HTTPException(422, "Use mono 16 kHz WAV chunks of at most 26 seconds")
    if not len(samples) or float(np.sqrt(np.mean(samples ** 2))) < 0.0005:
        return {"transcript": "", "model": "silence-check"}
    if language == "en":
        pieces, _ = speech["english"].transcribe(io.BytesIO(raw), language="en", vad_filter=True,
            condition_on_previous_text=False, temperature=0)
        text = " ".join(piece.text.strip() for piece in pieces).strip()
        model = "faster-whisper/small"
    else:
        with torch.inference_mode():
            text = speech["indic"](torch.from_numpy(samples).unsqueeze(0), language, "ctc")
        model = "ai4bharat/indic-conformer-600m-multilingual"
    if not isinstance(text, str) or len(text) > 15000:
        raise HTTPException(422, "Speech output needs review")
    words = text.split()
    if len(words) > 30 and len(set(words)) / len(words) < 0.15:
        raise HTTPException(422, "Repetitive speech output was withheld")
    return {"transcript": text.strip(), "model": model}


@app.post("/v1/audio/transcriptions", dependencies=[Depends(authorized)])
async def audio(file: UploadFile = File(...), language_code: str = Form(...)):
    code = {"en-IN": "en", "hi-IN": "hi", "mr-IN": "mr", "te-IN": "te", "bn-IN": "bn", "od-IN": "or"}.get(language_code)
    if code is None:
        raise HTTPException(422, "Select the recording language explicitly for this cloud speech service")
    if not speech["ready"]:
        raise HTTPException(503, "Speech models are initializing", headers={"Retry-After": "30"})
    raw = await file.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, "Send a 25-second WAV chunk")
    if not asr_lock.acquire(blocking=False):
        raise HTTPException(429, "Speech processing is busy", headers={"Retry-After": "10"})
    try:
        return await asyncio.to_thread(speech_text, raw, code)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Speech processing failed", headers={"Retry-After": "30"})
    finally:
        asr_lock.release()
