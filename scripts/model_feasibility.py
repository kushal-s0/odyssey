"""Measure real pinned Qwen inference; private outputs stay outside versioned reports."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path

import psutil
import torch
import truststore
from dotenv import load_dotenv

truststore.inject_into_ssl()

from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path)
    args = parser.parse_args()
    load_dotenv(ROOT / ".env.local", override=False)
    manifest = json.loads((ROOT / "evals/manifests/model-access.json").read_text(encoding="utf-8"))
    entry = next(r for r in manifest["models"] if r["task"] == "text_vision")
    if not torch.cuda.is_available():
        raise SystemExit("CUDA unavailable")
    started = time.perf_counter()
    common = {"revision": entry["revision"], "cache_dir": str(ROOT / ".cache/huggingface/hub"),
              "token": os.environ.get("HF_TOKEN")}
    model = Qwen3VLForConditionalGeneration.from_pretrained(entry["repo_id"], dtype=torch.float16,
                attn_implementation="sdpa", **common).to("cuda").eval()
    processor = AutoProcessor.from_pretrained(entry["repo_id"], min_pixels=64 * 32 * 32,
                                             max_pixels=512 * 512, **common)
    load_seconds = time.perf_counter() - started
    scenarios: list[tuple[str, list[dict]]] = []
    fixture = ("Return only JSON with business, product, customers, unit_price_inr, monthly_revenue_inr, "
               "and profit_inr. Unknowns are null. Do not invent facts. Source: I will sell tea to office "
               "workers near the bus stop. Tea is 10 rupees per cup. I expect 120 cups daily for 25 days. "
               "My costs are not known yet.")
    for label in ("synthetic_text_first", "synthetic_text_warm"):
        scenarios.append((label, [{"type": "text", "text": fixture}]))
    if args.image:
        scenarios.append(("private_handwritten_page", [{"type": "image", "image": str(args.image.resolve())},
            {"type": "text", "text": "Transcribe the handwritten business product/service and any visible monetary amounts on this page. Preserve original language. Mark uncertain text as [unreadable]. Do not infer missing text."}]))
    measurements, private = [], []
    for label, content in scenarios:
        torch.cuda.reset_peak_memory_stats()
        call_started = time.perf_counter()
        messages = [{"role": "user", "content": content}]
        inputs = processor.apply_chat_template(messages, tokenize=True, add_generation_prompt=True,
                                                return_dict=True, return_tensors="pt").to("cuda")
        inputs.pop("token_type_ids", None)
        with torch.inference_mode():
            result = model.generate(**inputs, max_new_tokens=192, do_sample=False)
        torch.cuda.synchronize()
        generated = result[0][inputs["input_ids"].shape[1]:]
        output = processor.decode(generated, skip_special_tokens=True)
        valid_json = False
        try:
            json.loads(output.removeprefix("```json").removeprefix("```").removesuffix("```").strip())
            valid_json = True
        except ValueError:
            pass
        measurement = {"case": label, "seconds": round(time.perf_counter() - call_started, 3),
            "input_tokens": inputs["input_ids"].shape[1], "output_tokens": len(generated),
            "peak_vram_allocated_bytes": torch.cuda.max_memory_allocated(),
            "peak_vram_reserved_bytes": torch.cuda.max_memory_reserved(),
            "process_rss_bytes": psutil.Process().memory_info().rss,
            "output_sha256": hashlib.sha256(output.encode()).hexdigest(),
            "json_parseable": valid_json, "token_cap_reached": len(generated) >= 192,
            "human_quality_validated": False}
        measurements.append(measurement)
        private.append({"case": label, "output": output})
        print(json.dumps(measurement), flush=True)
    public = {"repo_id": entry["repo_id"], "revision": entry["revision"], "dtype": "float16",
              "torch": torch.__version__, "device": torch.cuda.get_device_name(),
              "load_including_uncached_download_seconds": round(load_seconds, 3),
              "max_new_tokens": 192, "max_image_pixels": 512 * 512,
              "measurements": measurements, "scope": "Local feasibility only; not deployment or a quality benchmark."}
    for output_path, value in ((ROOT / "evals/reports/feasibility/qwen.json", public),
                                (ROOT / ".local/qwen-feasibility.private.json", private)):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
