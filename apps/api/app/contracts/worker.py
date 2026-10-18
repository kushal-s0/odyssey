from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from .models import Contract, Evidence, Language, StageClaim


class WorkerRequest(Contract):
    worker_id: str = Field(min_length=3, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    supported_stages: list[str] = Field(min_length=1, max_length=64)
    manifest_hash: str = Field(pattern=r'^[a-f0-9]{64}$')


class StageWork(StageClaim):
    stage_key: str
    model_manifest_hash: str
    worker_id: str
    backend: Literal['owned_worker', 'hf_zerogpu']


class ClaimResponse(Contract):
    claim: StageWork | None
    retry_after_seconds: int = 10


class StageInput(Contract):
    inherited_evidence: list[Evidence] = Field(default_factory=list, max_length=180)
    answer_fields: list[str] = Field(default_factory=list, max_length=3)
    submission_id: UUID
    input_revision_id: UUID
    input_kind: Literal['text', 'pdf', 'audio']
    source_hash: str
    source_text: str | None
    preferred_language: Language
    attachment_id: UUID | None
    media_type: str | None
    bytes: int | None
    pages: int | None
    duration_seconds: float | None
    previous_outputs: dict[str, dict[str, Any]]
    checkpoint: dict[str, Any] | None = None


class StageBegin(Contract):
    execution_id: UUID


class ExecutionAccepted(Contract):
    accepted: Literal[True] = True


class SourceAccess(Contract):
    # Relative API path; requires the current capability, never a public object URL.
    path: str
    sha256: str
    expires_at: datetime


class JobResume(Contract):
    expected_revision_id: UUID


class StagePublish(Contract):
    model_manifest_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    schema_version: Literal['1'] = '1'
    payload: dict[str, Any]


class StageCheckpoint(Contract):
    payload: dict[str, Any]


class StageFailure(Contract):
    code: Literal['runtime_unavailable','quota_exhausted','invalid_output','model_access_denied',
                  'stage_timeout','needs_review','model_unhealthy']
    retry_after_seconds: int = Field(default=30, ge=5, le=86400)


class StageReceipt(Contract):
    published: bool
    status: str


class RuntimeView(Contract):
    online_workers: int
    selected_backend: Literal['owned_worker','hf_zerogpu']
    manifest_hash: str
    model_readiness: Literal['not_verified'] = 'not_verified'
    measured_at: datetime
