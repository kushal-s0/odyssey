import hashlib
import re

from ..contracts.models import BusinessRecord, FieldStatus

PREPROCESSING = 'offer-customer-problem-v1'


def similarity_text(business: BusinessRecord) -> str:
    parts = []
    for name in ('offer', 'target_customers', 'problem'):
        field = getattr(business, name)
        if field.status == FieldStatus.present and isinstance(field.value, str):
            text = re.sub(r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?<!\w)\+?\d[\d\s()-]{8,}\d(?!\w)', '[contact removed]', field.value)
            parts.append(name + ': ' + text[:800])
    return '\n'.join(parts)


def summary_hash(business: BusinessRecord) -> str:
    return hashlib.sha256(similarity_text(business).encode()).hexdigest()
