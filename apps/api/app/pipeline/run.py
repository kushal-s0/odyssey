"""Native worker entrypoint for implemented screening stages."""
from collections.abc import Iterator
from typing import Any

from .assess import handler as assess
from .text import handler as text
from .pdf import handler as pdf


def handler(context: dict[str,Any]) -> Iterator[dict[str,Any]]:
    stage=context['work']['stage_key']
    yield from (assess(context) if stage=='assess' else pdf(context) if stage=='extract:pdf' else text(context))
