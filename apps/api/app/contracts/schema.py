from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic.json_schema import models_json_schema

from .models import (Assessment, BusinessRecord, ClarificationAnswer, DomainRating, ErrorEnvelope,
                     JobView, ReviewCreate, StageClaim, SubmissionAccepted, SubmissionCreate)

CONTRACTS = (Assessment, BusinessRecord, ClarificationAnswer, DomainRating, ErrorEnvelope,
             JobView, ReviewCreate, StageClaim, SubmissionAccepted, SubmissionCreate)


def build_openapi(application: FastAPI) -> dict[str, Any]:
    schema = get_openapi(title=application.title, version=application.version, routes=application.routes)
    _, definitions = models_json_schema([(model, "serialization") for model in CONTRACTS],
                                        ref_template="#/components/schemas/{model}")
    catalog = schema.setdefault("components", {}).setdefault("schemas", {})
    for name, definition in definitions.get("$defs", {}).items():
        # Route-derived request/response schemas take precedence as endpoints are added.
        catalog.setdefault(name, definition)
    return schema
