"""Perform a real GPU operation and record bounded reproducible device evidence."""
import json
import time
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable; do not claim local GPU inference works.")
    torch.manual_seed(17)
    started = time.perf_counter()
    first = torch.ones((512, 512), dtype=torch.float16, device="cuda")
    result = first @ first
    torch.cuda.synchronize()
    assert torch.all(result == 512).item()
    props = torch.cuda.get_device_properties(0)
    record = {"torch": torch.__version__, "cuda_build": torch.version.cuda,
              "device": props.name, "compute_capability": list(torch.cuda.get_device_capability()),
              "total_vram_bytes": props.total_memory,
              "peak_allocated_bytes": torch.cuda.max_memory_allocated(),
              "operation": "512x512 float16 matrix multiplication", "result": "pass",
              "elapsed_seconds": round(time.perf_counter() - started, 4),
              "scope": "CUDA operation only; not a model-fit or throughput benchmark."}
    output = ROOT / "evals/reports/feasibility/cuda.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
