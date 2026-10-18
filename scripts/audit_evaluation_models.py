"""Safe model inventory and three bounded legacy access probes, never inference uploads."""

# ruff: noqa: E402
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import truststore
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))
from app.worker.manifest import MANIFEST, MANIFEST_HASH


def main():
    truststore.inject_into_ssl()
    token = (
        os.environ.get("HF_TOKEN")
        or dotenv_values(ROOT / ".env.local").get("HF_TOKEN")
        or dotenv_values(ROOT / ".env").get("HF_TOKEN")
    )
    rows = []
    active = {"qwen", "ocr", "embedding", "speech", "speech_odia", "translation"}
    with httpx.Client(timeout=15, follow_redirects=True, trust_env=False) as client:
        for key, artifact in MANIFEST.items():
            if not isinstance(artifact, dict):
                continue
            snapshot = (
                ROOT
                / ".cache/huggingface/hub"
                / ("models--" + artifact["id"].replace("/", "--"))
                / "snapshots"
                / artifact["revision"]
            )
            weights = list(snapshot.glob("*.safetensors")) + list(
                snapshot.glob("pytorch_model*.bin")
            )
            row = {
                "artifact": key,
                **artifact,
                "selected": key in active,
                "snapshot_present": snapshot.is_dir(),
                "weight_files": len(weights),
                "cached_weight_bytes": sum(p.stat().st_size for p in weights),
            }
            if key not in active:
                began = time.perf_counter()
                try:
                    response = client.get(
                        f"https://huggingface.co/{artifact['id']}/resolve/{artifact['revision']}/config.json",
                        headers={"Authorization": "Bearer " + token} if token else {},
                    )
                    row["config_http_status"] = response.status_code
                except httpx.HTTPError as error:
                    row["access_error_type"] = type(error).__name__
                row["probe_seconds"] = round(time.perf_counter() - began, 3)
                row["scope"] = (
                    "Legacy not-selected access probe, not a model test or integration claim"
                )
            rows.append(row)
    report = {
        "measured_utc": datetime.now(timezone.utc).isoformat(),
        "manifest_hash": MANIFEST_HASH,
        "scope": "Local cache inventory; three bounded config GETs for not-selected legacy gated artifacts; existing HF credential read in memory only",
        "models": rows,
        "model_download_hash_report": "evals/reports/feasibility/pinned-downloads.json",
    }
    target = ROOT / "evals/reports/comprehensive/model-catalog.json"
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "selected_cached": sum(
                    r["selected"] and bool(r["weight_files"]) for r in rows
                ),
                "legacy_access": {
                    r["artifact"]: r.get(
                        "config_http_status", r.get("access_error_type")
                    )
                    for r in rows
                    if not r["selected"]
                },
            }
        )
    )


if __name__ == "__main__":
    main()
