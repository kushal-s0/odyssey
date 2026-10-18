from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from .models import Contract, FieldStatus, Language


class ClarificationQuestion(Contract):
    id: UUID
    field: str
    label: str
    question: str
    status: FieldStatus
    priority: int
    language: Language = 'en'
    english_question: str | None = None
    localization_note: str | None = None


class ClarificationBatch(Contract):
    expected_revision_id: UUID
    answers: dict[str, str] = Field(default_factory=dict, max_length=3)
    audio_attachment_id: UUID | None = None
    audio_fields: list[str] = Field(default_factory=list, max_length=3)
    answer_language: Language | None = None

    @model_validator(mode='after')
    def one_answer_mode(self) -> ClarificationBatch:
        if self.audio_attachment_id:
            if self.answers or not self.audio_fields or len(set(self.audio_fields)) != len(self.audio_fields):
                raise ValueError('Audio follow-up requires unique question fields and no typed answers')
        elif not self.answers or self.audio_fields:
            raise ValueError('Supply typed answers or one audio recording with question fields')
        return self

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
