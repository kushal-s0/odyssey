"""Conservative exact-span extraction for explicitly labelled English statements.

These rules resolve attribution, not truth. They never calculate numbers, repair
translations, choose between contradictory claims or accept embedded commands.
"""
import re

from ..contracts.pipeline import EvidenceBundle, ExtractionDraft
from .structure import IDENTITY, SOURCE_INSTRUCTION, UNKNOWN_STATEMENT

AMOUNT = r'(?:INR|Rs\.?|₹)\s*\d[\d,]*(?:\.\d+)?(?![\w,%]|\.\d)(?:\s*(?:per|a)\s+(?:cup|kg|kilogram|litre|liter|bag|piece|unit|hour))?'
PATTERNS = {
    'offer': [r'\bI (?:plan to open|want to sell|plan to sell|will sell|sell|run)\s+(?:a |an )?(?P<quote>.+?)(?=\s+(?:in|to|for|at|near)\b|[.!?]|$)'],
    'target_customers': [r'\b(?:my )?(?:target )?customers (?:are|will be)\s+(?P<quote>.+?)(?=\s+who\b|[.!?]|$)'],
    'problem': [r'\bcustomers .+?who (?P<quote>need .+?)(?=[.!?]|$)'],
    'market_research': [r'(?P<quote>\bI (?:spoke to|surveyed|interviewed)\b[^.!?]+)'],
    'differentiation': [r'\b(?:my |our )?(?:difference|differentiation|unique feature) is\s+(?P<quote>[^.!?]+)'],
    'competition': [r'(?P<quote>\b[^.!?]*(?:nearby|other) (?:tea )?(?:stalls|tailors|shops) (?:are alternatives|operate|sell)\b[^.!?]*)'],
    'existing_business': [r'(?P<quote>\b(?:the business has not started|I (?:already|currently) (?:run|operate)\b[^.!?]*))'],
    'investment': [rf'(?P<quote>\b(?:(?:total |initial |startup )*investment) (?:is|will be|of) {AMOUNT})'],
    'own_funds': [rf'(?P<quote>{AMOUNT} (?:of )?(?:my )?(?:own funds|savings))', rf'(?P<quote>\b(?:my )?(?:own funds|savings) (?:are|is|of) {AMOUNT})'],
    'requested_loan': [rf'(?P<quote>{AMOUNT} (?:requested )?loan)', rf'(?P<quote>\b(?:my )?(?:requested )?loan (?:is|of) {AMOUNT})'],
    'unit_price': [rf'(?P<quote>{AMOUNT}\s+(?:per|a)\s+(?:cup|kg|kilogram|litre|liter|bag|piece|unit|hour))', rf'(?P<quote>\b(?:unit |selling )?price (?:is|of) {AMOUNT})'],
    'expenses': [rf'(?P<quote>\b(?:(?:planned |monthly |daily |weekly |annual |yearly )*)(?:expenses|costs) (?:are|is|of) {AMOUNT})'],
    'revenue': [rf'(?P<quote>\b(?:(?:planned |reported |monthly |daily |weekly |annual |yearly )*)revenue (?:is|was|of) {AMOUNT})'],
}


def explicit_statements(bundle: EvidenceBundle) -> list[ExtractionDraft]:
    facts: list[dict[str,str|int]] = []
    for index, segment in enumerate(bundle.evidence):
        source = segment.english_text or ''
        if (segment.translation_uncertain or IDENTITY.search(source) or SOURCE_INSTRUCTION.search(source)
                or UNKNOWN_STATEMENT.search(source)):
            continue
        for field, patterns in PATTERNS.items():
            for pattern in patterns:
                for match in re.finditer(pattern, source, re.I):
                    quote = match.group('quote').strip()
                    if len(quote)>1000:
                        continue
                    # Do not trim conflicting statements down to their first
                    # amount, or accept generic non-proposals as offers.
                    if field == 'offer' and (quote.lower() in {'business','a business'} or re.match(r'^\d[\d,.]*\s',quote)):
                        continue
                    if field in {'investment','own_funds','requested_loan','unit_price','expenses','revenue'} and re.search(
                            r'\b(?:or|versus|correct|confirm|either)\b|\d\s*(?:k|lakhs?|crores?|thousands?|millions?|hundreds?|percent|%)\b|\d[\d,.]*\s*(?:to|-)\s*(?:(?:INR|Rs\.?|₹)\s*)?\d',source,re.I):
                        continue
                    if not any(fact['field']==field and fact['segment']==index and fact['quote']==quote for fact in facts):
                        facts.append({'field':field,'segment':index,'quote':quote})
    return [ExtractionDraft.model_validate({'facts':facts[start:start+40]}) for start in range(0,len(facts),40)]
