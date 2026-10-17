from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import pytest

from app.config import Settings
from app.db.pool import Database

ROOT = Path(__file__).resolve().parents[2]


def pytest_configure(config):
    if config.option.basetemp is None:
        parent = ROOT / '.local/pytest-runs'
        parent.mkdir(parents=True, exist_ok=True)
        # Unique workspace-owned directory: no existing user directory is reused/deleted.
        config.option.basetemp = str(parent / str(uuid4()))


@pytest.fixture
def database():
    location = ROOT / ".local/test-database-url"
    if not location.exists():
        pytest.skip("Local PostgreSQL not configured; this is not a passed integration check")
    url = location.read_text().strip()
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("These tests must never use a public database")
    instance = Database(Settings(app_env="test", database_url=url, _env_file=None))
    instance.open()
    try:
        yield instance
    finally:
        instance.close()


