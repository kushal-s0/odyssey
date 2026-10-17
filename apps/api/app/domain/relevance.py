"""Transparent advisory baseline. Candidate promotion is deliberately disabled."""
from __future__ import annotations

from typing import Literal

BASELINE='rules-cosine-baseline-v1'
SELECTED_RELEVANCE=BASELINE


def baseline_label(answer: str, similarity: float | None) -> Literal['missing','relevant','uncertain']:
    if not answer.strip():
        return 'missing'
    if similarity is not None and -.000001<=similarity<=1.000001 and similarity>=.35:
        return 'relevant'
    return 'uncertain'
