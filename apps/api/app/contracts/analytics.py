from typing import Literal

from .models import Contract


class ComparisonGroup(Contract):
    key: str
    label: str
    trade: str | None = None
    synthetic: bool
    count: int
    rated_count: int
    mean_score: float | None
    mean_completeness: float | None
    mean_coverage: float | None
    small_sample: bool


class ComparisonView(Contract):
    dimension: Literal['domain', 'trade', 'cohort', 'across_cohort']
    groups: list[ComparisonGroup]


class Analytics(Contract):
    rubric_version: str = 'rubric-v1'
    assessed_count: int
    eligible_count: int
    excluded_synthetic: int
    excluded_repeated_family: int
    include_synthetic: bool
    views: list[ComparisonView]
    note: str = ('Potential comparisons include only current, complete, ranking-eligible assessments using the same rubric. '
                 'Domain means use their assessable records; missing evidence is never zero. Small groups are descriptive only.')
