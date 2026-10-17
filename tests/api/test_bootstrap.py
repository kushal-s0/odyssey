from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.config import Settings
from app.main import create_app


def test_live_process_does_not_claim_infrastructure_ready() -> None:
    client = TestClient(create_app(Settings(app_env="test", _env_file=None)))
    live = client.get("/health/live")
    assert live.status_code == 200
    assert live.json()["status"] == "ok"
    assert live.headers["x-request-id"]
    assert client.get("/health/ready").status_code == 503
    assert client.get("/health/workspace").status_code == 503


def test_missing_production_configuration_is_actionable_and_redacted() -> None:
    with pytest.raises(ValidationError, match="Missing production configuration"):
        Settings(app_env="production", _env_file=None)


def test_paid_services_cannot_be_enabled() -> None:
    with pytest.raises(ValidationError):
        Settings(allow_paid_services=True, _env_file=None)


def test_empty_production_secret_does_not_pass_configuration_gate() -> None:
    with pytest.raises(ValidationError, match="database_url"):
        Settings(app_env="production", database_url="", _env_file=None)


def test_error_shape_and_unapproved_origin() -> None:
    client = TestClient(create_app(Settings(app_env="test", _env_file=None)))
    response = client.get("/unknown", headers={"Origin": "https://unapproved.example"})
    assert response.status_code == 404
    assert set(response.json()) == {"code", "message", "retryable", "request_id"}
    assert "access-control-allow-origin" not in response.headers
