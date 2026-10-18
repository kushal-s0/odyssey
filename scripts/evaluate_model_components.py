"""One component per process: real pinned local inference, authored synthetic references."""

# ruff: noqa: E402
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import re
import sys
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "apps/api"), str(ROOT / "evals")]
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
from comprehensive_metrics import error_rates, normal_text, numeric_strings
from app.worker.manifest import MANIFEST, MANIFEST_HASH

OUTPUT = ROOT / "evals/reports/comprehensive"
DATA = ROOT / "evals/benchmarks/comprehensive-component-cases.json"


def binary_metrics(rows, key):
    matrix = [[0, 0, 0], [0, 0, 0]]
    for row in rows:
        predicted = row[key]
        matrix[row["gold"]][predicted if predicted in (0, 1) else 2] += 1
    count = len(rows)
    covered = sum(sum(row[:2]) for row in matrix)
    correct = matrix[0][0] + matrix[1][1]
    f1 = []
    for cls in (0, 1):
        tp = matrix[cls][cls]
        fp = matrix[1 - cls][cls]
        fn = sum(matrix[cls]) - tp
        f1.append(2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0)
    predicted_irrelevant = matrix[0][1] + matrix[1][1]
    gold_irrelevant = sum(matrix[1])
    return {
        "count": count,
        "strict_accuracy": correct / count if count else None,
        "coverage": covered / count if count else None,
        "selective_accuracy": correct / covered if covered else None,
        "macro_f1": sum(f1) / 2,
        "irrelevant_precision": matrix[1][1] / predicted_irrelevant
        if predicted_irrelevant
        else None,
        "irrelevant_recall": matrix[1][1] / gold_irrelevant
        if gold_irrelevant
        else None,
        "confusion_rows_gold_relevant_irrelevant_columns_pred_relevant_irrelevant_abstain": matrix,
    }


def language(data, result):
    from app.providers.local_models import LanguageIdentifier

    model = LanguageIdentifier()
    rows = []
    for item in data["languages"]:
        start = time.perf_counter()
        predicted = model(item["text"], "und")
        rows.append(
            {
                **item,
                "result": predicted.model_dump(mode="json"),
                "correct": predicted.code == item["expected_language"],
                "seconds": round(time.perf_counter() - start, 6),
            }
        )
    detected = [r for r in rows if r["result"]["provenance"] == "detected"]
    result.update(
        cases=rows,
        model="py3langid-0.3.0",
        metrics={
            "exact_selected_code_accuracy": sum(r["correct"] for r in rows) / len(rows),
            "automatic_detection_coverage": len(detected) / len(rows),
            "accuracy_when_automatically_detected": sum(r["correct"] for r in detected)
            / len(detected)
            if detected
            else None,
        },
    )


def embedding(data, result):
    import numpy as np
    from app.providers.local_models import SentenceEncoder
    from app.domain.relevance import baseline_label

    load = time.perf_counter()
    model = SentenceEncoder()
    load = time.perf_counter() - load

    def encode256(texts):
        encoded = model.tokenizer(
            texts, padding=True, truncation=True, max_length=256, return_tensors="pt"
        )
        with model.torch.inference_mode():
            hidden = model.model(**encoded).last_hidden_state
            mask = encoded["attention_mask"].unsqueeze(-1)
            pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1)
            return model.torch.nn.functional.normalize(pooled, p=2, dim=1).numpy()

    q = encode256([row["question"] for row in data["qa"]])
    a = encode256([row["answer"] for row in data["qa"]])
    cosine = (q * a).sum(1)
    features = np.concatenate([q, a, abs(q - a), cosine[:, None]], axis=1)
    candidate = json.loads((ROOT / "models/relevance/candidate.json").read_text())
    parameters = candidate["parameters"]
    probability = 1 / (
        1
        + np.exp(
            -(features @ np.asarray(parameters["coef"])[0] + parameters["intercept"][0])
        )
    )
    rows = []
    for i, row in enumerate(data["qa"]):
        prediction = 1 if probability[i] >= 0.7 else 0 if probability[i] <= 0.3 else -1
        rows.append(
            {
                **row,
                "cosine": float(cosine[i]),
                "baseline": 0
                if baseline_label(row["answer"], float(cosine[i])) == "relevant"
                else -1,
                "candidate": prediction,
                "candidate_uncalibrated_irrelevant_probability": float(probability[i]),
            }
        )
    corpus = data["retrieval_corpus"]
    began = time.perf_counter()
    vectors = np.array([model.embed(row["text"]) for row in corpus])
    index_seconds = time.perf_counter() - began
    retrieval = []
    for query in data["retrieval_queries"]:
        began = time.perf_counter()
        similarity = vectors @ np.asarray(model.embed(query["text"]))
        order = np.argsort(-similarity)
        ranked = [corpus[i]["id"] for i in order]
        relevant = set(query["relevant_ids"])
        first = min(i + 1 for i, item in enumerate(ranked) if item in relevant)
        dcg = sum(
            (1 if item in relevant else 0) / math.log2(i + 2)
            for i, item in enumerate(ranked[:5])
        )
        ideal = sum(1 / math.log2(i + 2) for i in range(min(5, len(relevant))))
        retrieval.append(
            {
                **query,
                "ranked_ids": ranked,
                "top5_scores": [float(similarity[i]) for i in order[:5]],
                **{
                    f"recall_at_{k}": len(set(ranked[:k]) & relevant) / len(relevant)
                    for k in (1, 3, 5)
                },
                "reciprocal_rank": 1 / first,
                "ndcg_at_5": dcg / ideal,
                "seconds": round(time.perf_counter() - began, 4),
            }
        )
    result.update(
        model=MANIFEST["embedding"],
        load_seconds=round(load, 3),
        qa_cases=rows,
        baseline_metrics=binary_metrics(rows, "baseline"),
        experimental_candidate_metrics=binary_metrics(rows, "candidate"),
        candidate_serving="rejected; evaluated only, never promoted",
        retrieval_cases=retrieval,
        retrieval_metrics={
            name: sum(r[name] for r in retrieval) / len(retrieval)
            for name in [
                "recall_at_1",
                "recall_at_3",
                "recall_at_5",
                "reciprocal_rank",
                "ndcg_at_5",
            ]
        },
        index_seconds=round(index_seconds, 3),
    )


def translation(data, result):
    from app.providers.translation import LocalTranslator
    from sacrebleu.metrics import CHRF

    model = LocalTranslator()
    began = time.perf_counter()
    model.load()
    load = time.perf_counter() - began
    metric = CHRF(word_order=2)
    rows = []
    for item in data["translations"]:
        began = time.perf_counter()
        try:
            output = model.translate(
                item["source"], item["source_language"], item["target_language"]
            )
            normalized = normal_text(output)
            terms = []
            for term in item["required_terms"]:
                if term == "__negation__":
                    terms.append(
                        bool(re.search(r"\b(?:no|not|none|never|nobody)\b", normalized))
                    )
                elif term == "__unknown__":
                    terms.append(
                        bool(
                            re.search(
                                r"\b(?:not|undecided|unknown|yet|determined)\b",
                                normalized,
                            )
                        )
                    )
                else:
                    terms.append(term.casefold() in normalized)
            rows.append(
                {
                    **item,
                    "output": output,
                    "seconds": round(time.perf_counter() - began, 3),
                    "chrfpp": metric.sentence_score(output, [item["reference"]]).score,
                    "numbers_preserved": sorted(numeric_strings(item["source"]))
                    == sorted(numeric_strings(output)),
                    "required_terms_present": all(terms),
                    "status": "completed",
                }
            )
        except Exception as error:
            rows.append(
                {
                    **item,
                    "status": "failed",
                    "error_type": type(error).__name__,
                    "seconds": round(time.perf_counter() - began, 3),
                }
            )
    completed = [r for r in rows if r["status"] == "completed"]
    result.update(
        model=MANIFEST["translation"],
        load_seconds=round(load, 3),
        cases=rows,
        metrics={
            "completed": len(completed),
            "requested": len(rows),
            "number_preservation_rate": sum(
                r.get("numbers_preserved", False) for r in rows
            )
            / len(rows),
            "required_term_check_rate": sum(
                r.get("required_terms_present", False) for r in rows
            )
            / len(rows),
            "mean_sentence_chrfpp": sum(r["chrfpp"] for r in completed) / len(completed)
            if completed
            else None,
            "note": "Single authored reference per input. chrF++ is lexical similarity, not expert semantic accuracy; multilingual source fluency unreviewed.",
        },
    )


def ocr(data, result, directory):
    from PIL import Image, ImageDraw, ImageFont
    from app.providers.document_ocr import DocumentOCR

    start = time.perf_counter()
    model = DocumentOCR()
    load = time.perf_counter() - start
    rows = []
    for item in data["ocr"]:
        image = Image.new("RGB", (1200, 600), "white")
        draw = ImageDraw.Draw(image)
        fontpath = (
            Path("C:/Windows/Fonts/segoepr.ttf")
            if item["style"] == "rendered_script_font"
            else Path("C:/Windows/Fonts/arial.ttf")
        )
        font = ImageFont.truetype(str(fontpath), 32)
        draw.multiline_text(
            (50, 60), item["reference"], fill="black", font=font, spacing=25
        )
        image.save(directory / (item["id"] + ".png"))
        began = time.perf_counter()
        try:
            text = model.transcribe(image)
            rows.append(
                {
                    **item,
                    "output": text,
                    "status": "completed",
                    "seconds": round(time.perf_counter() - began, 3),
                    **error_rates(item["reference"], text),
                    "numbers_preserved": sorted(numeric_strings(item["reference"]))
                    == sorted(numeric_strings(text)),
                    "measurement": model.measurements[-1],
                }
            )
        except Exception as error:
            rows.append(
                {
                    **item,
                    "status": "failed",
                    "error_type": type(error).__name__,
                    "seconds": round(time.perf_counter() - began, 3),
                }
            )
        image.close()
    completed = [r for r in rows if r["status"] == "completed"]
    words = sum(r["reference_words"] for r in completed)
    chars = sum(r["reference_characters"] for r in completed)
    result.update(
        model=MANIFEST["ocr"],
        load_seconds=round(load, 3),
        cases=rows,
        metrics={
            "completed": len(completed),
            "requested": len(rows),
            "micro_wer": sum(r["word_edits"] for r in completed) / words
            if words
            else None,
            "micro_cer": sum(r["character_edits"] for r in completed) / chars
            if chars
            else None,
            "number_preservation_rate": sum(
                r.get("numbers_preserved", False) for r in rows
            )
            / len(rows),
            "note": "Typed and rendered-script synthetic images only; no genuine handwriting accuracy claim.",
        },
    )


def speech(data, result, directory):
    from app.providers.speech import LocalSpeech
    from app.pipeline.audio import decode, audio_chunks, handler
    import numpy as np

    started = time.perf_counter()
    model = LocalSpeech("en")
    load = time.perf_counter() - started
    rows = []
    for name in [
        "positive-tea-en",
        "negative-conflicting-en",
        "negative-irrelevant-en",
    ]:
        samples = decode(ROOT / "input/audio" / (name + ".wav"))
        reference = (
            (ROOT / "input/audio" / (name + ".transcript.txt"))
            .read_text(encoding="utf-8")
            .strip()
        )
        started = time.perf_counter()
        parts = []
        for start, stop in audio_chunks(samples):
            transcript, _ = model.transcribe(samples[start:stop], "en")
            parts.append(transcript)
        text = " ".join(parts)
        rows.append(
            {
                "id": name,
                "reference": reference,
                "output": text,
                "seconds": round(time.perf_counter() - started, 3),
                "audio_seconds": len(samples) / 16000,
                "chunks": len(parts),
                **error_rates(reference, text),
                "numbers_preserved": sorted(numeric_strings(reference))
                == sorted(numeric_strings(text)),
            }
        )
    samples = decode(ROOT / "input/audio/negative-silence.wav")
    started = time.perf_counter()
    raw_silence, _ = model.transcribe(samples[: 10 * 16000], "en")
    context = {
        "work": {"stage_key": "extract:audio", "pipeline_version": "screening-v1"},
        "source_path": str(ROOT / "input/audio/negative-silence.wav"),
        "input": {
            "submission_id": str(uuid4()),
            "input_revision_id": str(uuid4()),
            "input_kind": "audio",
            "source_hash": "a" * 64,
            "source_text": None,
            "preferred_language": "en",
            "attachment_id": str(uuid4()),
            "media_type": "audio/wav",
            "bytes": (ROOT / "input/audio/negative-silence.wav").stat().st_size,
            "pages": None,
            "duration_seconds": len(samples) / 16000,
            "previous_outputs": {},
        },
    }
    events = list(handler(context))
    silence = {
        "raw_model_output": raw_silence,
        "raw_model_seconds": round(time.perf_counter() - started, 3),
        "pipeline_failure": next(
            (event["failure"]["code"] for event in events if "failure" in event), None
        ),
        "pipeline_published": any("publish" in event for event in events),
        "rms": float(np.sqrt(np.mean(samples**2))),
    }
    words = sum(r["reference_words"] for r in rows)
    result.update(
        model=MANIFEST["speech"],
        load_seconds=round(load, 3),
        cases=rows,
        silence=silence,
        metrics={
            "micro_wer": sum(r["word_edits"] for r in rows) / words,
            "real_time_factor_warm": sum(r["seconds"] for r in rows)
            / sum(r["audio_seconds"] for r in rows),
            "note": "Three locally synthesized English voices from one SAPI voice; no regional/noisy/diverse-speaker accuracy claim.",
        },
    )


def odia(data, result, directory):
    from app.providers.speech import LocalSpeech
    from app.pipeline.audio import decode

    choices = []
    for archive in next(ROOT.glob("AI solution*")).rglob("*.zip"):
        with zipfile.ZipFile(archive) as bundle:
            for entry in bundle.infolist():
                if entry.filename.lower().endswith((".mp4", ".ogg", ".wav")) and any(
                    term in entry.filename.lower()
                    for term in ("odia", "odiya", "oriya")
                ):
                    choices.append((entry.file_size, archive, entry.filename))
    if not choices:
        raise RuntimeError("Private Odia sample not found")
    _, archive, name = min(choices)
    with zipfile.ZipFile(archive) as bundle:
        content = bundle.read(name)
    path = directory / "odia-source.private"
    path.write_bytes(content)
    samples = decode(path)[: 10 * 16000]
    started = time.perf_counter()
    model = LocalSpeech("or")
    load = time.perf_counter() - started
    started = time.perf_counter()
    text, identified = model.transcribe(samples, "or")
    (directory / "odia-transcript.private.txt").write_text(text, encoding="utf-8")
    result.update(
        model=MANIFEST["speech_odia"],
        load_seconds=round(load, 3),
        seconds=round(time.perf_counter() - started, 3),
        audio_seconds=len(samples) / 16000,
        source_sha256=hashlib.sha256(content).hexdigest(),
        transcript_characters=len(text),
        odia_script_present=any("\u0b00" <= c <= "\u0b7f" for c in text),
        language=identified.model_dump(mode="json"),
        wer=None,
        cer=None,
        reason="No independent human reference transcript. Private original/transcript retained ignored; no accuracy claimed.",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "component",
        choices=["language", "embedding", "translation", "ocr", "speech", "odia"],
    )
    args = parser.parse_args()
    raw = DATA.read_bytes()
    data = json.loads(raw)
    directory = (
        ROOT / ".local" / ("component-evaluation-" + args.component + "-" + uuid4().hex)
    )
    directory.mkdir(parents=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result = {
        "component": args.component,
        "scope": "Actual local pinned model on authored fixtures; original Odia sample has no reviewed transcript",
        "started_utc": datetime.now(timezone.utc).isoformat(),
        "manifest_hash": MANIFEST_HASH,
        "data_sha256": hashlib.sha256(raw).hexdigest(),
        "human_quality_validated": False,
        "deployed": False,
        "runtime": {
            p: importlib.metadata.version(p)
            for p in ["torch", "transformers", "numpy", "sacrebleu"]
        },
    }
    began = time.perf_counter()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
        function = {
            "language": language,
            "embedding": embedding,
            "translation": translation,
            "ocr": ocr,
            "speech": speech,
            "odia": odia,
        }[args.component]
        if args.component in {"ocr", "speech", "odia"}:
            function(data, result, directory)
        else:
            function(data, result)
        result["status"] = "completed"
        result["gpu"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        )
        result["peak_vram_bytes"] = (
            torch.cuda.max_memory_allocated() if torch.cuda.is_available() else 0
        )
    except Exception as error:
        import traceback

        (directory / "error.private.txt").write_text(
            traceback.format_exc(), encoding="utf-8"
        )
        result.update(status="failed", error_type=type(error).__name__)
    result["total_seconds"] = round(time.perf_counter() - began, 3)
    (OUTPUT / (args.component + ".json")).write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                key: value
                for key, value in result.items()
                if key not in {"cases", "qa_cases", "retrieval_cases", "runtime"}
            },
            ensure_ascii=True,
        )
    )
    if result["status"] != "completed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
