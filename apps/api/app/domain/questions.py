from uuid import UUID, uuid5
import json
from functools import lru_cache

from ..contracts.clarifications import ClarificationQuestion
from ..contracts.models import BusinessRecord, FieldStatus, Language
from ..config import ROOT

# The eighteen rubric fields have one stable, reviewable question each.
QUESTIONS = {
    'business_type': ('Business type', 'What type of business will you run?', 1),
    'offer': ('Product or service', 'What exactly will you sell or provide?', 0),
    'target_customers': ('Customers', 'Who will buy it? Describe your main customer group.', 0),
    'problem': ('Customer problem', 'What customer need or problem does your offer address?', 1),
    'location': ('Business location', 'Where will you operate? Give the locality, city or district, and state.', 0),
    'market_research': ('Demand evidence', 'Have you spoken to customers or tested demand? What did you learn?', 1),
    'raw_materials': ('Materials and equipment', 'What materials, equipment or other inputs will you need?', 2),
    'suppliers': ('Suppliers', 'Where will you obtain your materials or essential services?', 2),
    'investment': ('Startup investment', 'How much startup investment is needed? State the currency.', 0),
    'own_funds': ('Own funds', 'How much of that investment can you contribute yourself?', 2),
    'requested_loan': ('Funding gap', 'Do you need a loan or other funding? State the amount, or explicitly say none.', 2),
    'unit_price': ('Selling price', 'What will you charge per item or service? Include currency and unit.', 0),
    'revenue': ('Expected revenue', 'What sales revenue do you expect, and over what period?', 2),
    'expenses': ('Expected expenses', 'What operating expenses do you expect over the same period?', 1),
    'profit': ('Expected profit', 'What profit do you expect over that period? If unknown, say so.', 2),
    'competition': ('Competition', 'Which nearby businesses or alternatives serve these customers?', 1),
    'differentiation': ('Your difference', 'Why would customers choose you over those alternatives?', 1),
    'existing_business': ('Current stage', 'Is this a new proposal or a business already operating?', 2),
}


@lru_cache(maxsize=1)
def localizations() -> dict[str, dict[str, dict[str, str]]]:
    path = ROOT / 'data/localization/questions.json'
    return json.loads(path.read_text(encoding='utf-8'))['translations'] if path.is_file() else {}


def questions(business: BusinessRecord, revision: UUID, language: Language = 'en') -> list[ClarificationQuestion]:
    result = []
    for field, (label, text, priority) in QUESTIONS.items():
        status = getattr(business, field).status
        if status == FieldStatus.present:
            continue
        if status == FieldStatus.ambiguous:
            text = 'The original has conflicting or unclear information. ' + text + ' Explain which figure or statement applies.'
        elif status == FieldStatus.irrelevant:
            text = 'The previous answer did not address this topic. ' + text
        elif status == FieldStatus.unreadable:
            text = 'This part could not be read reliably. ' + text
        english = text
        translated = localizations().get(language, {}).get(field)
        if translated:
            label, text = translated['label'], translated['question']
            if status in {FieldStatus.ambiguous, FieldStatus.irrelevant, FieldStatus.unreadable}:
                text = localizations()[language]['_status'][status.value] + ' ' + text
        result.append(ClarificationQuestion(id=uuid5(revision, field), field=field, label=label,
            question=text, status=status, priority=priority, language=language if translated else 'en',
            english_question=english if translated else None,
            localization_note='Prepared translation; compare the English original if unclear. Human language review is pending.' if translated else None))
    return sorted(result, key=lambda item: (item.priority, list(QUESTIONS).index(item.field)))[:3]
