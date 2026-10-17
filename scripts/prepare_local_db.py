"""Generate local-only DB secrets without printing or overwriting user configuration."""
from pathlib import Path
import secrets
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
local = ROOT / ".local"
local.mkdir(exist_ok=True)
env = local / "postgres.env"
if not env.exists():
    env.write_text("LOCAL_POSTGRES_PASSWORD=" + secrets.token_urlsafe(32) + "\n", encoding="utf-8")
password = env.read_text(encoding="utf-8").strip().split("=", 1)[1]
url = f"postgresql://postgres:{quote(password, safe='')}@127.0.0.1:55432/udyam"
(local / "test-database-url").write_text(url, encoding="utf-8")
print("Local-only database secret/config prepared under ignored .local; values not displayed.")
