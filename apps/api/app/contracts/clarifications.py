from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from .models import Contract, FieldStatus


class ClarificationQuestion(Contract):
    id: UUID
    field: str
    label: str
    question: str
    status: FieldStatus
    priority: int


class ClarificationBatch(Contract):
    expected_revision_id: UUID
    answers: dict[str, str] = Field(min_length=1, max_length=18)

    @field_validator('answers')
    @classmethod
    def bounded_answers(cls, value: dict[str, str]) -> dict[str, str]:
        if any(not text.strip() or len(text) > 1500 for text in value.values()):
            raise ValueError('Each answer must contain 1–1500 characters')
        return {key: text.strip() for key, text in value.items()}


class RevisionView(Contract):
    id: UUID
    parent_revision_id: UUID | None
    revision_number: int
    input_kind: str
    created_at: datetime
    attachment_id: UUID | None
    assessment_version: int | None
