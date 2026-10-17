from decimal import ROUND_HALF_UP, Decimal

from ..contracts.models import BusinessRecord, Domain, DomainRating, FieldStatus, ScoreSummary

RUBRIC_VERSION = "rubric-v1"
WEIGHTS: dict[Domain, int] = {Domain.clarity: 15, Domain.customer_need: 20, Domain.market_potential: 20,
                           Domain.feasibility: 25, Domain.competition: 10, Domain.differentiation: 10}
APPLICABLE_FIELDS = ("business_type", "offer", "target_customers", "problem", "location", "market_research",
                    "raw_materials", "suppliers", "investment", "own_funds", "requested_loan", "unit_price",
                    "revenue", "expenses", "profit", "competition", "differentiation", "existing_business")
REVIEWABLE_EXCLUSIONS = frozenset({"raw_materials", "suppliers", "requested_loan", "profit"})
HUNDRED = Decimal(100)


def rounded(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def summarize(ratings: list[DomainRating], business: BusinessRecord, *, critical_conflict: bool = False,
              reviewer_exclusions: dict[str, str] | None = None, source_review_required: bool = False) -> ScoreSummary:
    """Exclusions must come from trusted reviewer policy, never applicant/model input."""
    by_domain = {r.domain: r for r in ratings}
    if len(ratings) != len(WEIGHTS) or set(by_domain) != set(WEIGHTS):
        raise ValueError("Supply exactly one rating per domain")
    exclusions = reviewer_exclusions or {}
    if not set(exclusions).issubset(REVIEWABLE_EXCLUSIONS) or any(len(reason.strip()) < 5 for reason in exclusions.values()):
        raise ValueError("Inapplicability needs an allowed field and a reviewed reason")
    fields = [name for name in APPLICABLE_FIELDS if name not in exclusions]
    usable = sum(getattr(business, name).status == FieldStatus.present for name in fields)
    weight = sum(WEIGHTS[r.domain] for r in ratings if r.rating is not None)
    weighted = sum((Decimal(WEIGHTS[r.domain]) * Decimal(r.rating) / 4
                    for r in ratings if r.rating is not None), Decimal(0))
    potential = rounded(HUNDRED * weighted / weight) if weight else None
    coverage = Decimal(weight) / HUNDRED
    unresolved = any(getattr(business, name).status != FieldStatus.present for name in ("offer", "target_customers"))
    critical_conflict = critical_conflict or any(getattr(business, name).status == FieldStatus.ambiguous
        for name in ("investment", "own_funds", "requested_loan", "unit_price", "revenue", "location"))
    reason = ("source_requires_review" if source_review_required else "critical_conflict" if critical_conflict else "offer_or_customers_unresolved" if unresolved
              else "insufficient_coverage" if coverage < Decimal("0.70") else None)
    return ScoreSummary(provisional_potential=potential, headline_potential=potential if reason is None else None,
        evidence_coverage=coverage, completeness_percent=rounded(HUNDRED * usable / len(fields)),
        usable_fields=usable, applicable_fields=len(fields), excluded_fields=exclusions,
        needs_clarification=reason is not None, ranking_eligible=weight == 100 and reason is None,
        withheld_reason=reason)
