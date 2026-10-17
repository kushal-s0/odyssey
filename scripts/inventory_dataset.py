"""Inspect original archives without extracting files or publishing personal data."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

import av
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {"english": "en", "hindi": "hi", "marathi": "mr", "telugu": "te",
             "telegu": "te", "bengali": "bn", "odia": "or"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def family_hint(archive: str, path: str) -> str:
    """Conservative grouping hints, explicitly requiring content-level review."""
    normalized = path.lower()
    if "audios" in archive.lower():
        return "audio-unreviewed"
    match = re.search(r"scenario\s*[-_]?\s*(\d+)", normalized)
    if "pdfs-" in archive.lower() and match and "/hindi " not in normalized:
        return "parallel-pdf-scenario-" + match.group(1)
    if "/english/" in normalized:
        match = re.search(r"example_(\d+)", normalized)
        if match:
            return "form-english-" + ("tea-variants" if int(match.group(1)) >= 3 else match.group(1))
    if any(x in normalized for x in ("/hindi/", "/telugu/")) and match:
        return "parallel-form-scenario-" + match.group(1)
    return "unreviewed-" + sha256((archive + path).encode())[:12]


def pdf_metadata(data: bytes) -> tuple[dict, str]:
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted and not reader.decrypt(""):
        raise ValueError("encrypted_pdf")
    pages = []
    texts = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        texts.append(text)
        pages.append({"page": index + 1, "text_characters": len(text),
                      "text_sha256": sha256(text.encode()),
                      "has_null_or_replacement": any(c in text for c in ("\0", "\ufffd")),
                      "width_points": float(page.mediabox.width),
                      "height_points": float(page.mediabox.height)})
    return {"pages": len(pages), "page_metadata": pages,
            "text_characters": sum(len(t) for t in texts),
            "scan_candidate": all(not t.strip() for t in texts)}, "\n\f\n".join(texts)


def audio_metadata(data: bytes, decode: bool) -> dict:
    with av.open(io.BytesIO(data)) as container:
        streams = list(container.streams.audio)
        if not streams:
            raise ValueError("no_audio_stream")
        stream = streams[0]
        duration = float(stream.duration * stream.time_base) if stream.duration is not None else None
        info = {"container": container.format.name, "audio_streams": len(streams),
                "video_streams": len(container.streams.video),
                "codec": stream.codec_context.name, "sample_rate": stream.codec_context.sample_rate,
                "channels": stream.codec_context.channels,
                "duration_seconds": round(duration, 3) if duration is not None else None,
                "decoded": False}
        if decode:
            seconds, count = 0.0, 0
            for frame in container.decode(stream):
                if not frame.sample_rate:
                    raise ValueError("invalid_sample_rate")
                seconds += frame.samples / frame.sample_rate
                count += 1
            if not count:
                raise ValueError("empty_audio")
            info.update(decoded=True, decoded_frames=count, decoded_seconds=round(seconds, 3))
        return info


def inventory(source: Path, decode: bool) -> tuple[dict, dict]:
    records, private = [], []
    archives = []
    for archive in sorted(source.rglob("*.zip")):
        archive_bytes = archive.read_bytes()
        archive_id = sha256(archive_bytes)
        archives.append({"id": archive_id, "bytes": len(archive_bytes)})
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as bundle:
            for entry in sorted(bundle.infolist(), key=lambda item: item.filename):
                if entry.is_dir():
                    continue
                if entry.file_size > 50 * 1024 * 1024:
                    raise ValueError("archive_entry_exceeds_inventory_budget")
                suffix = Path(entry.filename).suffix.lower()
                if suffix not in {".pdf", ".mp4", ".ogg"}:
                    raise ValueError("unexpected_archive_media")
                data = bundle.read(entry)
                identity = sha256(data)
                segments = [part.strip().lower() for part in entry.filename.split("/")]
                language = next((LANGUAGES[p] for p in segments if p in LANGUAGES), "und")
                record = {"id": identity, "archive_id": archive_id, "bytes": len(data),
                          "format": suffix[1:], "declared_folder_language": language,
                          "language_validated": False,
                          "family_hint": family_hint(archive.name, entry.filename),
                          "family_reviewed": False}
                private_record = {"id": identity, "archive_path": str(archive.relative_to(ROOT)),
                                  "entry_path": entry.filename}
                try:
                    if suffix == ".pdf":
                        metadata, text = pdf_metadata(data)
                        record.update(metadata)
                        private_record["extracted_text"] = text
                    else:
                        record.update(audio_metadata(data, decode))
                    record["inspection"] = "ok"
                except Exception as error:
                    record.update(inspection="error", error_type=type(error).__name__)
                records.append(record)
                private.append(private_record)
    records.sort(key=lambda item: item["id"])
    private.sort(key=lambda item: item["id"])
    summary = {"files": len(records), "by_format": dict(sorted(Counter(r["format"] for r in records).items())),
               "by_declared_language": dict(sorted(Counter(r["declared_folder_language"] for r in records).items())),
               "pdf_pages": sum(r.get("pages", 0) for r in records),
               "scan_candidates": sum(r.get("scan_candidate", False) for r in records),
               "decoded_audio": sum(r.get("decoded", False) for r in records),
               "audio_seconds": round(sum(r.get("decoded_seconds", 0) for r in records), 3),
               "errors": sum(r["inspection"] != "ok" for r in records)}
    public = {"schema_version": 1, "source": "private_organizer_archives",
              "license": "No redistribution permission established; originals remain private.",
              "family_policy": "Hints only; merge by reviewed business family before any split.",
              "extractors": {name: importlib.metadata.version(name) for name in ("pypdf", "av")},
              "archives": sorted(archives, key=lambda item: item["id"]), "summary": summary, "records": records}
    return public, {"schema_version": 1, "records": private}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "evals/manifests/dataset.json")
    parser.add_argument("--private-output", type=Path, default=ROOT / ".local/dataset-manifest.private.json")
    parser.add_argument("--decode-audio", action="store_true")
    args = parser.parse_args()
    source = args.source or next(ROOT.glob("AI solution*"))
    public, private = inventory(source, args.decode_audio)
    for path, content in ((args.output, public), (args.private_output, private)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(public["summary"], indent=2))
    return 1 if public["summary"]["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
