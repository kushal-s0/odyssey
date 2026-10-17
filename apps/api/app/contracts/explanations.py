from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from .models import Contract, Domain

ExplanationField = Literal['offer','target_customers','problem','location','market_research','raw_materials',
    'suppliers','investment','own_funds','requested_loan','unit_price','revenue','expenses','profit','competition',
    'differentiation','existing_business','business_type']


class DomainExplanation(Contract):
    domain: Domain
    explanation: str = Field(min_length=1, max_length=1000)
    evidence_fields: list[ExplanationField] = Field(default_factory=list, max_length=8)


class NextStep(Contract):
    action: str = Field(min_length=1, max_length=600)
    evidence_fields: list[ExplanationField] = Field(default_factory=list, max_length=8)


class ExplanationDraft(Contract):
    summary: str = Field(min_length=1, max_length=2000)
    domain_notes: list[DomainExplanation] = Field(min_length=6, max_length=6)
    next_steps: list[NextStep] = Field(min_length=1, max_length=5)


class Explanation(ExplanationDraft):
    assessment_id: UUID
    provider: Literal['groq', 'rule_based']
    model: str | None = None
    language: Literal['en', 'hi'] = 'en'
    status: Literal['ready','not_configured','unavailable','quota_limited']
    generated_at: datetime
    note: str


class ExplanationRequest(Contract):
    expected_assessment_id: UUID
    language: Literal['en','hi'] = 'en'
