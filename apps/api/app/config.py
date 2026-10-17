from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_parents = Path(__file__).resolve().parents
ROOT = _parents[3] if len(_parents) > 3 else Path.cwd()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env.local", extra="ignore", hide_input_in_errors=True)

    app_env: Literal["development", "test", "production"] = "development"
    app_version: str = "0.1.0"
    public_web_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    database_url: SecretStr | None = None
    database_pool_min: int = Field(default=1, ge=0, le=3)
    database_pool_max: int = Field(default=3, ge=1, le=10)
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_service_role_key: SecretStr | None = None
    auth_issuer: str | None = None
    auth_audience: str = "authenticated"
    auth_jwks_url: str | None = None
    private_upload_bucket: str = "originals"
    model_runtime: Literal["owned_worker", "hf_zerogpu"] = "owned_worker"
    allow_paid_services: Literal[False] = False
    enable_public_nominatim: bool = False
    max_upload_mb: int = Field(default=25, gt=0, le=50)
    max_pdf_pages: int = Field(default=20, ge=11, le=100)
    max_audio_seconds: int = Field(default=600, gt=0, le=1800)
    max_image_pixels: int = Field(default=1_600_000, gt=0, le=4_000_000)
    max_queue_depth: int = Field(default=20, gt=0, le=1000)
    max_active_jobs_per_user: int = Field(default=2, gt=0, le=20)
    max_model_concurrency: int = Field(default=1, gt=0, le=4)
    max_job_attempts: int = Field(default=3, gt=0, le=5)
    lease_seconds: int = Field(default=180, ge=30, le=900)
    stage_capability_signing_key: SecretStr | None = None
    worker_credential: SecretStr | None = None

    @model_validator(mode="after")
    def production_requirements(self) -> "Settings":
        if self.database_pool_min > self.database_pool_max:
            raise ValueError("Database pool minimum cannot exceed its maximum")
        if self.app_env == "production":
            missing = [key for key in ("database_url", "supabase_url", "supabase_service_role_key",
                                       "auth_issuer", "auth_jwks_url", "worker_credential",
                                       "stage_capability_signing_key")
                       if not (getattr(self, key).get_secret_value() if isinstance(getattr(self, key), SecretStr)
                               else getattr(self, key))]
            if missing:
                raise ValueError("Missing production configuration: " + ", ".join(missing))
            if not self.public_web_url.startswith("https://"):
                raise ValueError("PUBLIC_WEB_URL must use HTTPS in production")
            if any(origin == "*" or not origin.startswith("https://") for origin in self.cors_origins):
                raise ValueError("CORS_ORIGINS must contain exact HTTPS origins in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
