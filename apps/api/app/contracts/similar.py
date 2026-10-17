from typing import Literal
from uuid import UUID

from .models import Contract


class SimilarIdea(Contract):
    submission_id: UUID
    title: str
    customers: str | None
    trade: str
    cosine_similarity: float
    shared_traits: list[str]
    differences: list[str]
    synthetic: bool


class SimilarResults(Contract):
    status: Literal['ready', 'not_indexed']
    model: str
    preprocessing: str
    items: list[SimilarIdea]
    note: str = 'Similarity is advisory, not a probability, plagiarism finding or proof of competition.'
