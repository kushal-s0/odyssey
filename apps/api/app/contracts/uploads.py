from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from .models import Contract, Language

MediaType = Literal['application/pdf', 'audio/mp4', 'video/mp4', 'audio/ogg',
                    'audio/webm', 'audio/wav', 'audio/mpeg']


class UploadInitiate(Contract):
    filename: str = Field(min_length=1, max_length=120)
    media_type: MediaType
    bytes: int = Field(gt=0, le=25 * 1024 * 1024, strict=True)

    @field_validator('filename')
    @classmethod
    def safe_filename(cls, value: str) -> str:
        if value in {'.', '..'} or any(ord(c) < 32 or c in '/\\<>:"|?*' for c in value):
            raise ValueError('Use a simple display filename')
        return value


class UploadInitiated(Contract):
    attachment_id: UUID
    upload_path: str
    expires_in_seconds: int = 86_400


class UploadCompleted(Contract):
    attachment_id: UUID
    sha256: str
    media_type: MediaType
    bytes: int
    pages: int | None
    duration_seconds: float | None


class SubmissionView(Contract):
    id: UUID
    cohort_id: UUID | None
    revision_id: UUID
    revision_number: int
    input_kind: Literal['text', 'pdf', 'audio']
    preferred_language: Language
    source_text: str | None
    attachment_id: UUID | None
    job_id: UUID
    status: str
    created_at: datetime
