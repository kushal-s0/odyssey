"""Record model revisions/licenses and actual download access without exposing tokens."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import truststore

truststore.inject_into_ssl()

from dotenv import load_dotenv
from huggingface_hub import HfApi, hf_hub_download

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "text_vision": "Qwen/Qwen3-VL-2B-Instruct",
    "speech": "ai4bharat/indic-conformer-600m-multilingual",
    "indic_to_english": "ai4bharat/indictrans2-indic-en-dist-200M",
    "english_to_indic": "ai4bharat/indictrans2-en-indic-dist-200M",
    "embeddings": "sentence-transformers/all-MiniLM-L6-v2",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "evals/manifests/model-access.json")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env.local", override=False)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    api = HfApi(token=token)
    records = []
    for task, repo in MODELS.items():
        record = {"task": task, "repo_id": repo, "status": "unverified"}
        try:
            info = api.model_info(repo)
            record.update(revision=info.sha, gated=bool(info.gated),
                          license=(info.card_data or {}).get("license"))
            hf_hub_download(repo, "config.json", revision=info.sha, token=token,
                            cache_dir=str(ROOT / ".cache/huggingface/hub"))
            record["status"] = "config_download_verified"
        except Exception as error:
            response = getattr(error, "response", None)
            record.update(status="blocked", error_type=type(error).__name__,
                          http_status=getattr(response, "status_code", None))
        records.append(record)
        print(json.dumps(record), flush=True)
    output = {"schema_version": 1, "token_configured": bool(token),
              "scope": "Model metadata/config download only; no inference or Space provisioning.",
              "models": records,
              "hf_spaces": {"status": "not_provisioned", "publication_approved": False}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    return 1 if any(r["status"] == "blocked" for r in records) else 0


if __name__ == "__main__":
    sys.exit(main())
