from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
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
    storage_backend: Literal['supabase', 'local'] = 'supabase'
    local_storage_dir: Path = ROOT / '.local/private-storage'
    model_runtime: Literal["owned_worker", "hf_zerogpu"] = "owned_worker"
    allow_paid_services: Literal[False] = False
    enable_public_nominatim: bool = False
    groq_enabled: bool = True
    groq_api_key: SecretStr | None = None
    groq_model: str = Field(default='openai/gpt-oss-120b', min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9._/-]+$')
    groq_daily_requests_per_user: int = Field(default=30, ge=1, le=200)
    osm_user_agent: str = 'UdyamSaathi/0.1 (local assessment prototype)'
    osm_overpass_url: str = 'https://overpass.private.coffee/api/interpreter'
    osm_nominatim_url: str = 'https://nominatim.openstreetmap.org/search'
    osm_cache_hours: int = Field(default=24, ge=1, le=168)
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
    text_document_space_url: str | None = None
    speech_translation_space_url: str | None = None
    hf_token: SecretStr | None = None

    @field_validator('osm_overpass_url', 'osm_nominatim_url')
    @classmethod
    def osm_provider_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('OSM providers require an HTTPS URL without credentials or query parameters')
        return value

    @field_validator('text_document_space_url', 'speech_translation_space_url', mode='before')
    @classmethod
    def owned_space_origin(cls, value: object) -> object:
        if value is None or value == '':
            return None
        if not isinstance(value, str):
            raise ValueError('Space URL must be an owned HTTPS hf.space origin')
        parsed = urlsplit(value)
        if (parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.hf.space') or
                parsed.username or parsed.password or parsed.port or parsed.path not in {'', '/'} or
                parsed.query or parsed.fragment):
            raise ValueError('Space URL must be an owned HTTPS hf.space origin')
        return value.rstrip('/')

    @field_validator('allow_paid_services', mode='before')
    @classmethod
    def parse_paid_disabled(cls, value: object) -> object:
        return False if isinstance(value, str) and value.lower() == 'false' else value

    @model_validator(mode="after")
    def production_requirements(self) -> "Settings":
        if self.database_pool_min > self.database_pool_max:
            raise ValueError("Database pool minimum cannot exceed its maximum")
        for value in (self.auth_issuer, self.auth_jwks_url, self.supabase_url):
            if value:
                url = urlsplit(value)
                if url.username or url.password or url.query or url.fragment or not url.hostname:
                    raise ValueError("Authentication URLs must be absolute and contain no credentials or query")
                if url.scheme != "https" and not (self.app_env != "production" and
                        url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}):
                    raise ValueError("Authentication URLs require HTTPS, except local development")
        if self.app_env == "production":
            if self.storage_backend != 'supabase':
                raise ValueError('Production requires durable private Supabase storage')
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
