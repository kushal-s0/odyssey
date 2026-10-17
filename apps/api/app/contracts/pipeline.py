from typing import Annotated, Literal

from pydantic import Field

from .models import BusinessRecord, Contract, DomainRating, Evidence, RelevanceCheck


class EvidenceBundle(Contract):
    schema_version: Literal['1'] = '1'
    evidence: list[Evidence] = Field(max_length=200)
    warnings: list[str] = Field(default_factory=list, max_length=200)


FactName = Literal['summary','business_type','offer','target_customers','problem','market_research',
    'raw_materials','suppliers','investment','own_funds','requested_loan','unit_price','revenue',
    'expenses','profit','competition','differentiation','existing_business','location','additional']


class QuotedFact(Contract):
    field: FactName
    segment: Annotated[int, Field(strict=True, ge=0, le=199)]
    quote: str = Field(min_length=1, max_length=1000)
    label: str | None = Field(default=None,max_length=150)
    status: Literal['present','irrelevant','ambiguous','unreadable'] = 'present'


class ExtractionDraft(Contract):
    facts: list[QuotedFact] = Field(default_factory=list,max_length=40)
    # Taxonomy is a model suggestion, never scoring evidence.
    trade: str = Field(default='unknown',max_length=50)
    sector: str = Field(default='unknown',max_length=50)


class StructuredBundle(EvidenceBundle):
    business: BusinessRecord
    model_id: str
    model_revision: str
    preprocessing_version: Literal['text-evidence-v1'] = 'text-evidence-v1'
    drafts: list[ExtractionDraft] = Field(default_factory=list,max_length=200)
    measurements: list[dict[str, str | float | int | bool]] = Field(default_factory=list,max_length=200)


class AssessmentBundle(Contract):
    schema_version: Literal['1'] = '1'
    rubric_version: Literal['rubric-v1'] = 'rubric-v1'
    policy_version: Literal['grounded-domain-v1'] = 'grounded-domain-v1'
    model_id: str
    model_revision: str
    domains: list[DomainRating] = Field(min_length=6,max_length=6)
    relevance: list[RelevanceCheck] = Field(min_length=6,max_length=6)
    measurements: list[dict[str, str | float | int | bool]] = Field(default_factory=list,max_length=200)
