"""Export the same typed contract catalog used by the live API schema."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))

from app.contracts.schema import build_openapi
from app.main import create_app


def main() -> None:
    output = ROOT / "apps/web/openapi.json"
    output.write_text(json.dumps(build_openapi(create_app()), indent=2) + "\n", encoding="utf-8")
    print("Exported versioned API contracts to apps/web/openapi.json")


if __name__ == "__main__":
    main()
