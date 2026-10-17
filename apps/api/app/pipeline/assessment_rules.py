"""Shared lightweight grounding policy: API independently checks worker judgments."""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from ..contracts.models import Domain, DomainRating
from ..contracts.pipeline import StructuredBundle
from .normalize import numeric_tokens
from .structure import IDENTITY, SOURCE_INSTRUCTION

FIELDS: dict[Domain,tuple[str,...]]={
    Domain.clarity:('offer','target_customers','business_type','summary','existing_business'),
    Domain.customer_need:('problem','market_research','target_customers'),
    Domain.market_potential:('market_research','target_customers','location','revenue'),
    Domain.feasibility:('investment','own_funds','requested_loan','raw_materials','suppliers','unit_price','revenue','expenses','profit','existing_business'),
    Domain.competition:('competition','differentiation'),
    Domain.differentiation:('differentiation','offer','problem'),
}
QUESTIONS={Domain.clarity:'Is the offer, customer and operating model clearly explained?',
    Domain.customer_need:'What evidence supports a specific customer problem and demand?',
    Domain.market_potential:'What reachable segment, channel and market research supports demand?',
    Domain.feasibility:'Are resources, supply, funding and supplied economics coherent?',
    Domain.competition:'Which alternatives are identified and how will the business respond?',
    Domain.differentiation:'What specific customer-relevant distinction is supported?'}
ANCHORS={Domain.clarity:'1 offer thin; 2 offer/customer understandable; 3 consistent operating details',
    Domain.customer_need:'0 supplied facts contradict need; 1 vague claim; 2 specific problem assumed; 3 specific conversations/orders',
    Domain.market_potential:'0 conflicting supplied market assumptions; 1 unbounded claim; 2 plausible local segment, thin research; 3 reachable segment/channel and research',
    Domain.feasibility:'0 evidenced critical resource/economic weakness; 1 broad resource plan; 2 plausible resources/investment, thin detail; 3 coherent supplied resources/supply/funding/economics',
    Domain.competition:'0 no credible response to evidenced alternatives; 1 unsupported no-competition claim; 2 alternatives generic response; 3 specific alternatives and grounded response',
    Domain.differentiation:'0 advantage contradicted; 1 generic superiority; 2 plausible distinction; 3 specific customer-relevant distinction supported'}


def domain_facts(bundle: StructuredBundle,domain: Domain) -> tuple[dict[str,Any],set[UUID]]:
    business=bundle.business
    names=FIELDS[domain]
    # Unresolved conflicting evidence is never silently a low or high rating.
    if any(getattr(business,name).status=='ambiguous' for name in names):
        return {},set()
    present={name for name in names if getattr(business,name).status=='present'}
    sufficient=(
        {'offer','target_customers'}.issubset(present) if domain==Domain.clarity else
        bool(present & {'problem','market_research'}) if domain==Domain.customer_need else
        ('market_research' in present or {'target_customers','location'}.issubset(present)) if domain==Domain.market_potential else
        bool(present & {'investment','raw_materials','suppliers','expenses'}) if domain==Domain.feasibility else
        'competition' in present if domain==Domain.competition else 'differentiation' in present)
    if not sufficient:
        return {},set()
    sources={s.id:s for s in bundle.evidence}
    facts: dict[str,Any]={}
    refs: set[UUID]=set()
    for name in names:
        field=getattr(business,name)
        if name not in present:
            continue
        if any(ref not in sources or sources[ref].translation_uncertain for ref in field.source_segment_ids):
            raise ValueError('Unusable field evidence')
        encoded=field.model_dump(mode='json')
        if IDENTITY.search(json.dumps(encoded)) or SOURCE_INSTRUCTION.search(json.dumps(encoded)):
            raise ValueError('Identity/directive cannot enter scoring')
        facts[name]=encoded
        refs.update(field.source_segment_ids)
    return facts,refs


def validate_ratings(bundle: StructuredBundle,ratings: list[DomainRating]) -> None:
    if len(ratings)!=6 or {r.domain for r in ratings}!=set(Domain):
        raise ValueError('Exactly one judgment per domain is required')
    for rating in ratings:
        facts,refs=domain_facts(bundle,rating.domain)
        if rating.rating is not None and (not facts or rating.rating>3 or rating.basis!='self_reported'):
            raise ValueError('Unsupported rating or verification claim')
        if not set(rating.source_segment_ids).issubset(refs):
            raise ValueError('Rating cites evidence outside its usable domain fields')
        if IDENTITY.search(rating.reason) or SOURCE_INSTRUCTION.search(rating.reason):
            raise ValueError('Identity/directive in judgment')
        supplied=set(numeric_tokens(json.dumps(facts)))
        if not set(numeric_tokens(rating.reason)).issubset(supplied):
            raise ValueError('Reason invents a supplied number')
