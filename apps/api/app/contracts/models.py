from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class FieldStatus(StrEnum):
    present = "present"
    missing = "missing"
    irrelevant = "irrelevant"
    ambiguous = "ambiguous"
    unreadable = "unreadable"


Language = Literal["en", "hi", "mr", "te", "bn", "or", "und"]
T = TypeVar("T")


class Alternative(Contract, Generic[T]):
    value: T
    source_segment_ids: list[UUID] = Field(min_length=1, max_length=50)
    note: str = Field(min_length=1, max_length=1000)


class EvidenceField(Contract, Generic[T]):
    value: T | None = None
    status: FieldStatus = FieldStatus.missing
    source_segment_ids: list[UUID] = Field(default_factory=list, max_length=50)
    alternatives: list[Alternative[T]] = Field(default_factory=list, max_length=10)
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def evidence_consistency(self) -> EvidenceField[T]:
        if self.status == FieldStatus.present:
            if self.value is None or not self.source_segment_ids:
                raise ValueError("Present fields require a value and original evidence")
        elif self.value is not None:
            raise ValueError("Unresolved fields must keep value null")
        if self.status == FieldStatus.ambiguous and not (self.alternatives or self.note):
            raise ValueError("Ambiguous fields require alternatives or an explanation")
        if self.alternatives and self.status != FieldStatus.ambiguous:
            raise ValueError("Competing alternatives require ambiguous status")
        if isinstance(self.value, str) and not self.value.strip():
            raise ValueError("An empty string is missing, not a present fact")
        if isinstance(self.value, list) and not self.value:
            raise ValueError("An empty list is missing, not a present fact")
        return self


class LanguageResult(Contract):
    code: Language = "und"
    provenance: Literal["declared", "detected", "confirmed", "unknown"] = "unknown"
    model_id: str | None = None
    model_confidence: float | None = Field(default=None, ge=0, le=1)
    needs_confirmation: bool = True

    @model_validator(mode="after")
    def detector_provenance(self) -> LanguageResult:
        if self.provenance == "detected" and not self.model_id:
            raise ValueError("Detected language requires a detector identifier")
        if self.provenance in {"declared", "unknown"} and self.model_confidence is not None:
            raise ValueError("Declared/unknown language has no detector confidence")
        return self


class EvidenceBase(Contract):
    id: UUID
    submission_id: UUID
    input_revision_id: UUID
    original_text: str = Field(min_length=1, max_length=30000)
    english_text: str | None = Field(default=None, max_length=30000)
    language: LanguageResult = Field(default_factory=LanguageResult)
    translation_uncertain: bool = False


class TextEvidence(EvidenceBase):
    kind: Literal["text"] = "text"
    start_character: int = Field(ge=0)
    end_character: int = Field(gt=0)

    @model_validator(mode="after")
    def character_order(self) -> TextEvidence:
        if self.end_character <= self.start_character:
            raise ValueError("Invalid source character range")
        return self


class PdfEvidence(EvidenceBase):
    kind: Literal["pdf"] = "pdf"
    attachment_id: UUID
    page: int = Field(ge=1, le=100)
    normalized_box: tuple[float, float, float, float] | None = None

    @model_validator(mode="after")
    def box_bounds(self) -> PdfEvidence:
        if self.normalized_box:
            left, top, right, bottom = self.normalized_box
            if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
                raise ValueError("Bounding box must be ordered normalized page coordinates")
        return self


class AudioEvidence(EvidenceBase):
    kind: Literal["audio"] = "audio"
    attachment_id: UUID
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)

    @model_validator(mode="after")
    def time_order(self) -> AudioEvidence:
        if self.end_seconds <= self.start_seconds:
            raise ValueError("Invalid audio time range")
        return self


Evidence = Annotated[TextEvidence | PdfEvidence | AudioEvidence, Field(discriminator="kind")]


class Money(Contract):
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    currency: Literal["INR", "unknown"]
    period: Literal["day", "week", "month", "year", "once", "unknown"] = "unknown"
    unit: str | None = Field(default=None, max_length=100)


class Location(Contract):
    locality: str | None = Field(default=None, max_length=200)
    block: str | None = Field(default=None, max_length=200)
    district: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=100)
    pin: str | None = Field(default=None, pattern=r"^[1-9][0-9]{5}$")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    precision: Literal["unknown", "district", "locality", "pin", "confirmed_point"] = "unknown"
    applicant_confirmed: bool = False

    @model_validator(mode="after")
    def coordinate_pair(self) -> Location:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Coordinates require both latitude and longitude")
        if self.precision == "confirmed_point" and (not self.applicant_confirmed or self.latitude is None):
            raise ValueError("A confirmed point requires coordinates and applicant confirmation")
        return self


class Trade(StrEnum):
    tea_stall = "tea_stall"
    tailoring = "tailoring"
    food_service = "food_service"
    dairy = "dairy"
    poultry = "poultry"
    beauty_services = "beauty_services"
    mobile_repair = "mobile_repair"
    agricultural_inputs = "agricultural_inputs"
    solar_services = "solar_services"
    packaged_water = "packaged_water"
    bag_manufacturing = "bag_manufacturing"
    other = "other"
    unknown = "unknown"


class AdditionalFact(Contract):
    label: str = Field(min_length=1, max_length=150)
    fact: EvidenceField[str]


class BusinessRecord(Contract):
    schema_version: Literal["1"] = "1"
    summary: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    business_type: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    offer: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    target_customers: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    problem: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    location: EvidenceField[Location] = Field(default_factory=EvidenceField[Location])
    market_research: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    raw_materials: EvidenceField[list[str]] = Field(default_factory=EvidenceField[list[str]])
    suppliers: EvidenceField[list[str]] = Field(default_factory=EvidenceField[list[str]])
    investment: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    own_funds: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    requested_loan: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    unit_price: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    revenue: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    expenses: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    profit: EvidenceField[Money] = Field(default_factory=EvidenceField[Money])
    competition: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    differentiation: EvidenceField[str] = Field(default_factory=EvidenceField[str])
    existing_business: EvidenceField[bool] = Field(default_factory=EvidenceField[bool])
    sector: Literal["agriculture", "food_beverage", "retail", "services", "manufacturing", "other", "unknown"] = "unknown"
    trade: Trade = Trade.unknown
    additional_facts: list[AdditionalFact] = Field(default_factory=list, max_length=50)


class Domain(StrEnum):
    clarity = "clarity"
    customer_need = "customer_need"
    market_potential = "market_potential"
    feasibility = "feasibility"
    competition = "competition"
    differentiation = "differentiation"


class DomainRating(Contract):
    domain: Domain
    rating: Annotated[int, Field(strict=True, ge=0, le=4)] | None
    reason: str = Field(min_length=1, max_length=4000)
    source_segment_ids: list[UUID] = Field(default_factory=list, max_length=50)
    basis: Literal["self_reported", "reviewer_verified", "mixed", "insufficient"] = "self_reported"

    @model_validator(mode="after")
    def rating_evidence(self) -> DomainRating:
        if self.rating is not None and not self.source_segment_ids:
            raise ValueError("A numerical rating requires original evidence")
        if self.rating is None and self.basis != "insufficient":
            raise ValueError("An unassessed rating must state insufficient basis")
        if self.rating is not None and self.basis == "insufficient":
            raise ValueError("Insufficient evidence cannot produce a numerical rating")
        return self


class ScoreSummary(Contract):
    rubric_version: Literal["rubric-v1"] = "rubric-v1"
    provisional_potential: Decimal | None = Field(ge=0, le=100)
    headline_potential: Decimal | None = Field(ge=0, le=100)
    evidence_coverage: Decimal = Field(ge=0, le=1)
    completeness_percent: Decimal = Field(ge=0, le=100)
    usable_fields: int = Field(ge=0)
    applicable_fields: int = Field(ge=0)
    excluded_fields: dict[str, str] = Field(default_factory=dict)
    needs_clarification: bool
    ranking_eligible: bool
    withheld_reason: str | None = None

    @model_validator(mode="after")
    def score_consistency(self) -> ScoreSummary:
        if self.usable_fields > self.applicable_fields:
            raise ValueError("Usable fields cannot exceed the applicability denominator")
        if self.needs_clarification and (self.headline_potential is not None or not self.withheld_reason):
            raise ValueError("Clarification requires a withheld headline and a reason")
        if self.ranking_eligible and (self.evidence_coverage != 1 or self.needs_clarification
                                     or self.headline_potential is None):
            raise ValueError("Ranked results require complete domain coverage and an eligible headline")
        return self


class Assessment(Contract):
    id: UUID
    submission_id: UUID
    input_revision_id: UUID
    version: int = Field(ge=1)
    created_at: datetime
    pipeline_version: str = Field(min_length=1)
    model_manifest_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    business: BusinessRecord
    evidence: list[Evidence] = Field(max_length=1000)
    domains: list[DomainRating] = Field(min_length=6, max_length=6)
    scores: ScoreSummary
    strengths: list[str] = Field(default_factory=list, max_length=10)
    gaps: list[str] = Field(default_factory=list, max_length=20)
    risks: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def traceability(self) -> Assessment:
        if set(r.domain for r in self.domains) != set(Domain):
            raise ValueError("Exactly one rating per assessment domain is required")
        ids = {segment.id for segment in self.evidence}
        if len(ids) != len(self.evidence):
            raise ValueError("Evidence identifiers must be unique")
        if any(segment.submission_id != self.submission_id for segment in self.evidence):
            raise ValueError("Evidence must belong to this submission")

        def check(value: object) -> None:
            if isinstance(value, dict):
                refs = value.get("source_segment_ids", [])
                if any(ref not in ids for ref in refs):
                    raise ValueError("Unknown source evidence reference")
                for child in value.values():
                    check(child)
            elif isinstance(value, list):
                for child in value:
                    check(child)

        check(self.business.model_dump())
        for rating in self.domains:
            if not set(rating.source_segment_ids).issubset(ids):
                raise ValueError("Unknown rating evidence reference")
        if self.created_at.tzinfo is None:
            raise ValueError("Assessment timestamps must include a timezone")
        return self


class ErrorEnvelope(Contract):
    code: str
    message: str
    retryable: bool
    request_id: UUID


class SubmissionCreate(Contract):
    text: str | None = Field(default=None, min_length=1, max_length=30000)
    attachment_ids: list[UUID] = Field(default_factory=list, max_length=1)
    preferred_language: Language = "en"
    cohort_id: UUID | None = None
    declared_location: Location | None = None
    consent: Literal[True]

    @model_validator(mode="after")
    def exactly_one_input(self) -> SubmissionCreate:
        if bool(self.text and self.text.strip()) == bool(self.attachment_ids):
            raise ValueError("Provide text or one attachment")
        return self


class SubmissionAccepted(Contract):
    submission_id: UUID
    revision_id: UUID
    job_id: UUID
    status: Literal["queued"] = "queued"


class JobStatus(StrEnum):
    queued = "queued"
    extracting = "extracting"
    translating = "translating"
    structuring = "structuring"
    assessing = "assessing"
    enriching = "enriching"
    completed = "completed"
    partial = "partial"
    needs_review = "needs_review"
    waiting_for_worker = "waiting_for_worker"
    waiting_for_runtime = "waiting_for_runtime"
    quota_exhausted = "quota_exhausted"
    failed = "failed"
    cancelled = "cancelled"


class JobView(Contract):
    id: UUID
    submission_id: UUID
    status: JobStatus
    backend: Literal["owned_worker", "hf_zerogpu"]
    completed_stages: int = Field(ge=0)
    total_stages: int = Field(gt=0)
    attempt: int = Field(ge=0)
    error: ErrorEnvelope | None = None
    retry_after_seconds: int | None = Field(default=None, ge=0)


class StageClaim(Contract):
    job_id: UUID
    stage_id: UUID
    lease_generation: int = Field(gt=0)
    lease_expires_at: datetime
    capability: str = Field(min_length=16)
    input_revision_id: UUID
    pipeline_version: str
    input_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class ReviewCreate(Contract):
    expected_revision_id: UUID
    outcome: Literal["needs_clarification", "deeper_evaluation", "mentoring", "skilling", "reviewed"]
    reason: str = Field(min_length=5, max_length=4000)
    corrections: BusinessRecord | None = None


class ClarificationAnswer(Contract):
    expected_revision_id: UUID
    question_id: UUID
    text: str | None = Field(default=None, min_length=1, max_length=10000)
    attachment_id: UUID | None = None

    @model_validator(mode="after")
    def exactly_one_answer(self) -> ClarificationAnswer:
        if bool(self.text and self.text.strip()) == bool(self.attachment_id):
            raise ValueError("Provide one text or audio answer")
        return self
