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

# Guidance asks for the applicant's own facts, never an invented sector benchmark.
GUIDANCE = {
    'business_type': ('Helps the reviewer understand your operating model.', 'Describe the trade and whether you make, sell or provide a service.'),
    'offer': ('The offer is needed before the idea can be assessed fairly.', 'Name the product or service and what a customer receives.'),
    'target_customers': ('Demand cannot be assessed without a clear customer group.', 'Describe who buys, where they are and when they need it.'),
    'problem': ('Connects your offer to a specific customer need.', 'Describe the problem in the customer’s words, if you know it.'),
    'location': ('Local demand and competitors depend on the business area.', 'Give the locality, district and state; a home address is unnecessary.'),
    'market_research': ('Separates assumptions about demand from things you have tested.', 'Say who you spoke to, how many, when and what they said. Untested is a valid answer.'),
    'raw_materials': ('Shows what you need to deliver your product or service.', 'List essential inputs or equipment. Explain if this does not apply.'),
    'suppliers': ('Helps identify dependencies and supply risks.', 'Name known sources and whether availability or prices have been checked.'),
    'investment': ('Startup cost is needed to understand funding feasibility.', 'State the total, currency and what it covers. Separate one-time costs from running costs.'),
    'own_funds': ('Helps distinguish money available from money still needed.', 'State the amount and currency you can actually contribute; say unknown if undecided.'),
    'requested_loan': ('Makes the funding gap explicit without assuming a loan is required.', 'State the amount and currency, explicitly say no loan, or say undecided.'),
    'unit_price': ('Price needs a unit before revenue can be checked.', 'State currency and the item, hour, visit or other unit. Identify estimates as estimates.'),
    'revenue': ('Sales estimates need a time period to be comparable.', 'State currency, period and expected sales volume. Label projections clearly.'),
    'expenses': ('Costs and revenue must use the same time period.', 'State currency, period and the costs included. Mention costs you have not estimated.'),
    'profit': ('Clarifies what remains after costs rather than treating sales as profit.', 'Use the same period as revenue and costs; say unknown if costs are incomplete.'),
    'competition': ('Shows which alternatives customers already use.', 'Name known alternatives and how you learned about them; do not guess competitor facts.'),
    'differentiation': ('Explains why a customer might choose your offer.', 'Describe a concrete difference and any evidence that customers value it.'),
    'existing_business': ('Distinguishes actual operating results from a new proposal.', 'Say whether the business is already operating or still planned.'),
}


@lru_cache(maxsize=1)
def localizations() -> dict[str, dict[str, dict[str, str]]]:
    path = ROOT / 'data/localization/questions.json'
    return json.loads(path.read_text(encoding='utf-8'))['translations'] if path.is_file() else {}


def questions(business: BusinessRecord, revision: UUID, language: Language = 'en',
              *, excluded_fields: frozenset[str] = frozenset()) -> list[ClarificationQuestion]:
    result = []
    for field, (label, text, priority) in QUESTIONS.items():
        detail = getattr(business, field)
        status = detail.status
        if status == FieldStatus.present or field in excluded_fields:
            continue
        reason, hint = GUIDANCE[field]
        if status == FieldStatus.ambiguous:
            text = 'The original has conflicting or unclear information. ' + text + ' Explain which figure or statement applies.'
            reason = 'Resolve conflicting information before relying on this field. ' + reason
            priority = -1
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
            question=text, status=status, priority=priority, reason=reason, answer_hint=hint,
            source_note=detail.note,
            source_segment_ids=list(dict.fromkeys([*detail.source_segment_ids,
                *(source for alternative in detail.alternatives for source in alternative.source_segment_ids)]))[:50],
            language=language if translated else 'en',
            english_question=english if translated else None,
            localization_note='Prepared translation; compare the English original if unclear. Human language review is pending.' if translated else None))
    return sorted(result, key=lambda item: (item.priority, list(QUESTIONS).index(item.field)))[:3]
