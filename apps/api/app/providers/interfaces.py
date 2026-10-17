from typing import Protocol

from ..contracts.models import BusinessRecord, DomainRating, Evidence, Language


class BusinessExtractor(Protocol):
    def extract(self, evidence: list[Evidence]) -> BusinessRecord: ...


class Translator(Protocol):
    def translate(self, text: str, source: Language, target: Language) -> str: ...


class Assessor(Protocol):
    def rate(self, business: BusinessRecord, evidence: list[Evidence]) -> list[DomainRating]: ...


class Embedder(Protocol):
    def embed(self, english_summary: str) -> list[float]: ...
