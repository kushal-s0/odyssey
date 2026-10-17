from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from .models import Contract, JobStatus, Language


class QueueItem(Contract):
    id: UUID
    revision_id: UUID
    cohort_id: UUID | None
    cohort_name: str | None
    synthetic: bool
    title: str
    input_kind: str
    language: Language
    status: JobStatus
    potential: float | None
    completeness: float | None
    ranking_eligible: bool
    trade: str | None
    reviewed: bool
    created_at: datetime


class QueuePage(Contract):
    items: list[QueueItem]
    total: int
    limit: int
    offset: int


class ReviewInput(Contract):
    expected_revision_id: UUID
    outcome: Literal['needs_clarification', 'deeper_evaluation', 'mentoring', 'skilling', 'reviewed']
    reason: str = Field(min_length=5, max_length=4000)
    correction_text: str | None = Field(default=None, min_length=5, max_length=6000)
    source_verified: bool = False
    replace_transcript: bool = False

    @field_validator('reason', 'correction_text')
    @classmethod
    def nonblank(cls, value: str | None) -> str | None:
        if value is not None and len(value.strip()) < 5:
            raise ValueError('Provide a meaningful reason or correction')
        return value.strip() if value else value


class ReviewView(Contract):
    id: UUID
    input_revision_id: UUID
    outcome: str
    reason: str
    correction_revision_id: UUID | None
    created_at: datetime
