"""Native worker entrypoint for implemented screening stages."""
from collections.abc import Iterator
from typing import Any

from .assess import handler as assess
from .text import handler as text


def handler(context: dict[str,Any]) -> Iterator[dict[str,Any]]:
    yield from (assess(context) if context['work']['stage_key']=='assess' else text(context))
