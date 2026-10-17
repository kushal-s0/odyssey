from __future__ import annotations

import re
from decimal import Decimal
from typing import Any, Literal

from ..contracts.models import AdditionalFact, BusinessRecord, EvidenceField, FieldStatus, Location, Money, Trade
from ..contracts.pipeline import EvidenceBundle, ExtractionDraft, StructuredBundle
from ..worker.manifest import MANIFEST
from .normalize import numeric_tokens

MONEY_FIELDS={'investment','own_funds','requested_loan','unit_price','revenue','expenses','profit'}
LIST_FIELDS={'raw_materials','suppliers'}
IDENTITY=re.compile(r'\b(?:my name|applicant name|phone|mobile number|caste|gender|my education|educational qualification|aadhaar)\b',re.I)
SOURCE_INSTRUCTION=re.compile(r'ignore.{0,50}instructions|\b(?:system|assistant)\s*:|\bgive\s+(?:every|all)\s+(?:rating|score)|\binvent\s+(?:INR|₹|\d)',re.I)
UNKNOWN_STATEMENT=re.compile(r"\b(?:not known|unknown|not sure|not decided|don't know|do not know|not available|yet to decide)\b",re.I)


def quoted_money(quote: str) -> Money | None:
    if re.search(r'(?<!\w)[-−]\s*\d|%|\bpercent|\d\s*(?:k|lakhs?|crores?|thousands?|millions?|hundreds?)\b',quote,re.I):
        return None
    numbers=numeric_tokens(quote)
    if len(numbers)!=1:
        return None  # Ambiguous periods/quantities are never guessed.
    for token in re.findall(r'\d+(?:[,\.]\d+)*',quote):
        if ',' in token and not re.fullmatch(r'\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d+)?',token):
            return None
    currency: Literal['INR','unknown']='INR' if re.search(r'₹|\b(?:inr|rs\.?|rupees?)\b',quote,re.I) else 'unknown'
    period: Any='unknown'
    for name,pattern in [('day',r'daily|per day|a day'),('week',r'weekly|per week'),
                         ('month',r'monthly|per month'),('year',r'yearly|annually|per year')]:
        if re.search(pattern,quote,re.I):
            period=name
            break
    try:
        unit=re.search(r'\b(?:per|a)\s+(cup|kg|kilogram|litre|liter|bag|piece|unit|hour)\b',quote,re.I)
        return Money(amount=Decimal(numbers[0]),currency=currency,period=period,unit=unit.group(1) if unit else None)
    except ValueError:
        return None


def assemble(bundle: EvidenceBundle, drafts: list[ExtractionDraft]) -> StructuredBundle:
    candidates: dict[str,list[dict[str,Any]]]={}
    additional=[]
    warnings=list(bundle.warnings)
    for draft in drafts:
        for fact in draft.facts:
            if fact.segment>=len(bundle.evidence):
                raise ValueError('Model cited an unknown segment')
            segment=bundle.evidence[fact.segment]
            source=segment.english_text
            if (not source or segment.translation_uncertain or fact.quote not in source or
                    IDENTITY.search(source) or SOURCE_INSTRUCTION.search(source)):
                raise ValueError('Unsupported or identity-bearing model fact')
            value: Any=fact.quote
            if fact.status!='present':
                candidates.setdefault(fact.field,[]).append({'status':fact.status,'source_segment_ids':[segment.id]})
                continue
            if UNKNOWN_STATEMENT.search(fact.quote):
                continue  # Explicit ignorance cannot become a positive fact in another domain.
            if fact.field in MONEY_FIELDS:
                value=quoted_money(fact.quote)
                if value is None:
                    if not numeric_tokens(fact.quote):
                        continue  # Explicit unknown money remains missing, not a numeric conflict.
                    warnings.append('ambiguous_number:'+fact.field)
                    candidates.setdefault(fact.field,[]).append({'unresolved':True,'source_segment_ids':[segment.id]})
                    continue
            elif fact.field in LIST_FIELDS:
                value=[fact.quote]
            elif fact.field=='existing_business':
                lowered=fact.quote.lower()
                if re.search(r'\b(?:no existing|not yet|new business|plan to|will start)\b',lowered):
                    value=False
                elif re.search(r'\b(?:already|currently|existing business|running)\b',lowered):
                    value=True
                else:
                    continue
            elif fact.field=='location':
                value=Location(locality=fact.quote[:200],precision='locality',applicant_confirmed=False)
            if fact.field=='additional':
                additional.append(AdditionalFact(label=fact.label or 'Additional business fact',
                    fact=EvidenceField[str](value=fact.quote,status=FieldStatus.present,source_segment_ids=[segment.id])))
                continue
            candidates.setdefault(fact.field,[]).append({'value':value,'source_segment_ids':[segment.id]})
    fields: dict[str,Any]={}
    for field,values in candidates.items():
        refs=list(dict.fromkeys(ref for row in values for ref in row['source_segment_ids']))
        resolved=[row for row in values if 'value' in row]
        unique: list[dict[str,Any]]=[]
        for row in resolved:
            if not any(row['value']==previous['value'] for previous in unique):
                unique.append(row)
        unresolved_states={row['status'] for row in values if 'status' in row}
        if unresolved_states:
            status=next(iter(unresolved_states)) if len(unresolved_states)==1 and not resolved else 'ambiguous'
            fields[field]={'status':status,'source_segment_ids':refs,'note':'The supplied answer requires review.'}
        elif any('unresolved' in row for row in values):
            fields[field]={'status':'ambiguous','note':'Supplied figures require review; no amount inferred.',
                           'source_segment_ids':refs}
        elif len(unique)==1:
            fields[field]={'value':unique[0]['value'],'status':'present','source_segment_ids':refs}
        elif field in LIST_FIELDS:
            fields[field]={'value':list(dict.fromkeys(row['value'][0] for row in unique)),
                           'status':'present','source_segment_ids':refs}
        else:
            fields[field]={'status':'ambiguous','source_segment_ids':refs,'note':'Multiple source-backed values need review.',
                'alternatives':[{'value':row['value'],'source_segment_ids':row['source_segment_ids'],
                                 'note':'Supplied alternative'} for row in unique[:10]]}
    trades={d.trade for d in drafts if d.trade in {trade.value for trade in Trade} and d.trade!='unknown'}
    sectors={d.sector for d in drafts if d.sector in {'agriculture','food_beverage','retail','services','manufacturing','other'}}
    business=BusinessRecord.model_validate({**fields,'additional_facts':additional[:50],
        'trade':next(iter(trades)) if len(trades)==1 else 'unknown',
        'sector':next(iter(sectors)) if len(sectors)==1 else 'unknown'})
    model=MANIFEST['qwen']
    return StructuredBundle(evidence=bundle.evidence,business=business,warnings=warnings[:200],
                            model_id=model['id'],model_revision=model['revision'],drafts=drafts)
