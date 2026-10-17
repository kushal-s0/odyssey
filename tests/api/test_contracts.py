from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.contracts.models import (Assessment, AudioEvidence, BusinessRecord, Domain, DomainRating,
    ErrorEnvelope, EvidenceField, LanguageResult, PdfEvidence, SubmissionCreate, TextEvidence)
from app.domain.scoring import summarize

SUBMISSION = UUID("10000000-0000-0000-0000-000000000001")
REVISION = UUID("20000000-0000-0000-0000-000000000001")
SOURCE = UUID("30000000-0000-0000-0000-000000000001")
OTHER = UUID("40000000-0000-0000-0000-000000000001")


def source() -> TextEvidence:
    return TextEvidence(id=SOURCE, submission_id=SUBMISSION, input_revision_id=REVISION,
                        original_text="Tea for office workers at 10 rupees a cup.", start_character=0, end_character=44)


def business() -> BusinessRecord:
    return BusinessRecord(offer=EvidenceField[str](value="Tea", status="present", source_segment_ids=[SOURCE]),
        target_customers=EvidenceField[str](value="Office workers", status="present", source_segment_ids=[SOURCE]))


def ratings(value: int | None = 3) -> list[DomainRating]:
    return [DomainRating(domain=d, rating=value, reason="Synthetic contract fixture; not an actual assessment.",
                         source_segment_ids=[SOURCE] if value is not None else [],
                         basis="self_reported" if value is not None else "insufficient") for d in Domain]


def assessment() -> Assessment:
    record, domains = business(), ratings()
    return Assessment(id=OTHER, submission_id=SUBMISSION, input_revision_id=REVISION,
        version=1, created_at=datetime(2026, 10, 17, tzinfo=timezone.utc), pipeline_version="test-v1",
        model_manifest_hash="a" * 64, business=record, evidence=[source()], domains=domains,
        scores=summarize(domains, record))


def test_valid_partial_record_preserves_unknowns_and_false_is_present() -> None:
    record = business()
    assert record.investment.value is None
    assert record.investment.status == "missing"
    no = EvidenceField[bool](value=False, status="present", source_segment_ids=[SOURCE])
    assert no.value is False
    assert assessment().business.offer.value == "Tea"


@pytest.mark.parametrize("payload", [
    {"value": "Invented", "status": "present"},
    {"value": "Invented", "status": "missing"},
    {"value": "", "status": "present", "source_segment_ids": [SOURCE]},
    {"value": "  ", "status": "present", "source_segment_ids": [SOURCE]},
    {"status": "ambiguous"},
])
def test_invalid_fact_states_rejected(payload: dict) -> None:
    with pytest.raises(ValidationError):
        EvidenceField[str].model_validate(payload)


@pytest.mark.parametrize("value", [-1, 5, 1.5, True, "3"])
def test_ratings_are_strict_bounded_integers(value: object) -> None:
    with pytest.raises(ValidationError):
        DomainRating(domain="clarity", rating=value, reason="Invalid test value", source_segment_ids=[SOURCE])


def test_rating_requires_original_evidence_and_null_requires_insufficiency() -> None:
    with pytest.raises(ValidationError):
        DomainRating(domain="clarity", rating=3, reason="Unsupported numerical rating")
    with pytest.raises(ValidationError):
        DomainRating(domain="clarity", rating=None, reason="Unknown", basis="self_reported")


def test_broken_or_cross_submission_evidence_rejected() -> None:
    payload = assessment().model_dump()
    payload["business"]["offer"]["source_segment_ids"] = [OTHER]
    with pytest.raises(ValidationError, match="Unknown source"):
        Assessment.model_validate(payload)
    payload = assessment().model_dump()
    payload["evidence"][0]["submission_id"] = OTHER
    with pytest.raises(ValidationError, match="belong to this submission"):
        Assessment.model_validate(payload)


def test_duplicate_domains_and_naive_timestamp_rejected() -> None:
    payload = assessment().model_dump()
    payload["domains"][-1] = payload["domains"][0]
    with pytest.raises(ValidationError, match="Exactly one"):
        Assessment.model_validate(payload)
    payload = assessment().model_dump()
    payload["created_at"] = datetime(2026, 10, 17)
    with pytest.raises(ValidationError, match="timezone"):
        Assessment.model_validate(payload)


def test_evidence_coordinates_and_timestamps_are_meaningful() -> None:
    base = dict(id=SOURCE, submission_id=SUBMISSION, input_revision_id=REVISION,
                original_text="Fixture", attachment_id=OTHER)
    with pytest.raises(ValidationError, match="Bounding box"):
        PdfEvidence(**base, page=1, normalized_box=(0.9, 0.1, 0.2, 0.8))
    with pytest.raises(ValidationError, match="Invalid audio"):
        AudioEvidence(**base, start_seconds=10, end_seconds=5)


def test_declared_language_is_not_detected_confidence() -> None:
    with pytest.raises(ValidationError):
        LanguageResult(code="hi", provenance="declared", model_confidence=0.99)
    with pytest.raises(ValidationError):
        LanguageResult(code="mr", provenance="detected")


def test_identity_is_not_a_business_scoring_field() -> None:
    with pytest.raises(ValidationError):
        BusinessRecord.model_validate({"name": "Synthetic identity"})
    assert not {"name", "gender", "education", "phone", "social_category"} & set(BusinessRecord.model_fields)


def test_submission_requires_one_real_input_and_consent() -> None:
    assert SubmissionCreate(text="A small shop", consent=True).text
    for payload in ({"text": "   ", "consent": True}, {"text": "Idea", "attachment_ids": [OTHER], "consent": True},
                    {"text": "Idea", "consent": False}):
        with pytest.raises(ValidationError):
            SubmissionCreate.model_validate(payload)


def test_all_unknown_never_becomes_a_zero_potential_score() -> None:
    result = summarize(ratings(None), BusinessRecord())
    assert result.provisional_potential is None
    assert result.headline_potential is None
    assert result.evidence_coverage == 0
    assert result.completeness_percent == 0
    assert not result.ranking_eligible


def test_partial_denominator_is_explicit_and_headline_is_withheld() -> None:
    values = ratings(None)
    values[0] = DomainRating(domain="clarity", rating=4, reason="Fixture", source_segment_ids=[SOURCE])
    values[1] = DomainRating(domain="customer_need", rating=2, reason="Fixture", source_segment_ids=[SOURCE])
    result = summarize(values, business())
    assert result.provisional_potential == Decimal("71.43")
    assert result.evidence_coverage == Decimal("0.35")
    assert result.headline_potential is None
    assert result.withheld_reason == "insufficient_coverage"


def test_seventy_percent_coverage_allows_headline_but_not_ranking() -> None:
    values = ratings()
    values[2] = DomainRating(domain="market_potential", rating=None, reason="Unknown", basis="insufficient")
    values[5] = DomainRating(domain="differentiation", rating=None, reason="Unknown", basis="insufficient")
    result = summarize(values, business())
    assert result.evidence_coverage == Decimal("0.70")
    assert result.headline_potential == Decimal("75.00")
    assert not result.ranking_eligible


def test_full_score_and_critical_conflict_have_distinct_outcomes() -> None:
    result = summarize(ratings(4), business())
    assert result.headline_potential == Decimal("100.00") and result.ranking_eligible
    conflict = summarize(ratings(4), business(), critical_conflict=True)
    assert conflict.headline_potential is None and not conflict.ranking_eligible
    assert conflict.provisional_potential == Decimal("100.00")


def test_completeness_is_separate_and_exclusion_cannot_remove_offer() -> None:
    result = summarize(ratings(4), business())
    assert result.usable_fields == 2 and result.applicable_fields == 18
    assert result.completeness_percent == Decimal("11.11")
    with pytest.raises(ValueError, match="reviewed reason"):
        summarize(ratings(4), business(), reviewer_exclusions={"offer": "Not supplied"})
    excluded = summarize(ratings(4), business(), reviewer_exclusions={"raw_materials": "Reviewed service applicability"})
    assert excluded.applicable_fields == 17 and excluded.excluded_fields


def test_sanitized_scenario_fixtures_preserve_expected_states() -> None:
    fixtures = json.loads((Path(__file__).resolve().parents[2] / "evals/fixtures/business-records.json").read_text())
    for case in fixtures:
        assert case["origin"] == "synthetic"
        if "business" in case:
            record = BusinessRecord.model_validate(case["business"])
            assert record.offer.status == case["expected_offer_status"]
            if case["id"] == "complete":
                result = summarize(ratings(3), record)
                assert result.completeness_percent == 100
            if case["id"] == "conflicting":
                assert record.unit_price.status == "ambiguous" and record.unit_price.value is None
                assert len(record.unit_price.alternatives) == 2
        else:
            assert ErrorEnvelope.model_validate(case["error"]).retryable
