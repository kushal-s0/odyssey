from typing import Literal
from uuid import UUID

from .models import Contract


class EconomicsCheck(Contract):
    kind: Literal['funding','revenue','profit']
    title: str
    status: Literal['consistent','discrepancy','calculated','needs_clarification']
    explanation: str
    formula: str | None = None
    calculated_amount: str | None = None
    stated_amount: str | None = None
    currency: str | None = None
    period: str | None = None
    source_segment_ids: list[UUID]
    assumptions: list[str]


class Economics(Contract):
    assessment_id: UUID
    checks: list[EconomicsCheck]
    note: str = 'Arithmetic checks use supplied figures and explicit periods. Calculated estimates do not overwrite claims or alter assessment scores. Revenue is not profit.'
