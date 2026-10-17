import re
from decimal import Decimal
from typing import Literal
from uuid import UUID

from ..contracts.economics import Economics, EconomicsCheck
from ..contracts.models import Assessment, Money


def same_period(amount: Money, target: str) -> Decimal | None:
    if amount.period == target and target not in {'unknown','once'}:
        return amount.amount
    factors = {('day','week'): Decimal(7), ('week','day'): Decimal(1)/7,
               ('month','year'): Decimal(12), ('year','month'): Decimal(1)/12}
    factor = factors.get((amount.period, target))
    return amount.amount * factor if factor is not None else None


def money(value: Decimal) -> str:
    return str(value.quantize(Decimal('.01')))


def economics(value: Assessment) -> Economics:
    business = value.business
    checks = []
    uncertain_sources = {segment.id for segment in value.evidence if segment.translation_uncertain or
        (segment.kind == 'pdf' and segment.extraction_uncertain) or
        (segment.kind == 'audio' and segment.transcription_uncertain)}
    def supplied(name: str) -> Money | None:
        field = getattr(business,name)
        if field.status != 'present' or uncertain_sources.intersection(field.source_segment_ids):
            return None
        return field.value if isinstance(field.value,Money) else None
    # Cash-flow amounts are never filled from missing facts, and unknown
    # currencies/periods never silently become INR/month.
    def missing(kind: str, title: str, text: str, refs: list[UUID]) -> EconomicsCheck:
        return EconomicsCheck.model_validate({'kind':kind, 'title':title, 'status':'needs_clarification',
            'explanation':text, 'source_segment_ids':refs, 'assumptions':[]})
    fields = [business.investment, business.own_funds, business.requested_loan]
    refs = list(dict.fromkeys(ref for field in fields for ref in field.source_segment_ids))
    amounts = [supplied(name) for name in ('investment','own_funds','requested_loan')]
    if all(amount is not None and amount.currency == 'INR' and amount.period in {'once','unknown'} for amount in amounts):
        investment, own, loan = amounts
        assert investment is not None and own is not None and loan is not None
        total = own.amount + loan.amount
        close = abs(total - investment.amount) <= Decimal('1')
        checks.append(EconomicsCheck(kind='funding', title='Startup funding balance',
            status='consistent' if close else 'discrepancy', explanation='Own funds plus the requested loan ' +
            ('match' if close else 'do not match') + ' the stated startup investment (one rupee rounding tolerance). Other funding, if any, needs clarification.',
            formula=f'{money(own.amount)} + {money(loan.amount)} = {money(total)}', calculated_amount=money(total),
            stated_amount=money(investment.amount), currency='INR', period='once', source_segment_ids=refs,
            assumptions=['Startup funding is a one-time capital requirement; no recurring periods or other funding sources are assumed.']))
    else:
        checks.append(missing('funding','Startup funding balance', 'Supply startup investment, own funds and loan (including an explicit zero where applicable) in a known currency. Recurring amounts cannot be compared as startup capital.', refs))
    fields = [business.revenue, business.expenses, business.profit]
    refs = list(dict.fromkeys(ref for field in fields for ref in field.source_segment_ids))
    revenue = supplied('revenue')
    expenses = supplied('expenses')
    profit = supplied('profit')
    expense_amount = same_period(expenses, revenue.period) if expenses and revenue else None
    if revenue and expenses and revenue.currency == expenses.currency == 'INR' and expense_amount is not None:
        calculated = revenue.amount - expense_amount
        reported = same_period(profit, revenue.period) if profit and profit.currency == 'INR' else None
        status: Literal['calculated','consistent','discrepancy'] = 'calculated' if reported is None else 'consistent' if abs(calculated-reported) <= Decimal('1') else 'discrepancy'
        checks.append(EconomicsCheck(kind='profit', title='Revenue versus operating surplus', status=status,
            explanation='Revenue minus the supplied expenses gives an estimated operating surplus, not verified net profit. Unlisted costs, tax, debt service and owner pay may change it.' +
                (' The stated profit differs from this calculation.' if status == 'discrepancy' else ''),
            formula=f'{money(revenue.amount)} − {money(expense_amount)} = {money(calculated)}',
            calculated_amount=money(calculated), stated_amount=money(reported) if reported is not None else None,
            currency='INR', period=revenue.period, source_segment_ids=refs,
            assumptions=['Uses supplied expense categories only.', 'Month/year conversion uses twelve months; week/day conversion uses seven calendar days. No month-to-day conversion is assumed.']))
    else:
        checks.append(missing('profit','Revenue versus operating surplus', 'Revenue is not profit. Supply revenue and expenses in a known currency and compatible periods before calculating a surplus.', refs))
    quantities: dict[tuple[Decimal,str], list[UUID]] = {}
    days: dict[Decimal, list[UUID]] = {}
    for segment in value.evidence:
        if not segment.english_text or segment.id in uncertain_sources:
            continue
        text = segment.english_text
        for match in re.finditer(r'\b(\d+(?:\.\d+)?)\s+(cups?|pieces?|items?|units?|bags?|kg|litres?|liters?)\s+(?:per\s+day|a\s+day|daily)\b', text, re.I):
            unit = match[2].lower().rstrip('s')
            quantities.setdefault((Decimal(match[1]),unit), []).append(segment.id)
        for match in re.finditer(r'\b(\d+(?:\.\d+)?)\s+(?:(?:working|operating)\s+)?days?\s+(?:per\s+month|a\s+month|each\s+month)\b', text, re.I):
            if 0 < Decimal(match[1]) <= 31:
                days.setdefault(Decimal(match[1]), []).append(segment.id)
    price = supplied('unit_price')
    if len(quantities) == len(days) == 1 and price and price.currency == 'INR' and price.unit:
        (quantity, unit), quantity_refs = next(iter(quantities.items()))
        operating_days, day_refs = next(iter(days.items()))
        if price.unit.lower().rstrip('s') != unit:
            checks.append(missing('revenue','Sales-based revenue estimate', 'The sales quantity and selling price use different units. Confirm a compatible unit before calculating revenue.', quantity_refs + day_refs + business.unit_price.source_segment_ids))
        else:
            calculated = quantity * price.amount * operating_days
            reported = same_period(revenue, 'month') if revenue and revenue.currency == 'INR' else None
            checks.append(EconomicsCheck(kind='revenue',title='Sales-based revenue estimate',
                status='calculated' if reported is None else 'consistent' if abs(calculated-reported) <= Decimal('1') else 'discrepancy',
                explanation='Estimated monthly sales revenue from the stated daily quantity, unit price and operating days. This is revenue, not profit.',
                formula=f'{quantity} × {price.amount} × {operating_days} = {money(calculated)}',
                calculated_amount=money(calculated),stated_amount=money(reported) if reported is not None else None,
                currency='INR',period='month',source_segment_ids=list(dict.fromkeys(quantity_refs+day_refs+business.unit_price.source_segment_ids+business.revenue.source_segment_ids)),
                assumptions=['Assumes the supplied daily sales and unit price apply on each stated operating day; no sales growth or additional costs are assumed.']))
    else:
        checks.append(missing('revenue','Sales-based revenue estimate', 'Supply one clear daily sales quantity, matching unit price and operating days per month. Conflicting quantities, missing days or unknown currency are not guessed.', business.unit_price.source_segment_ids))
    return Economics(assessment_id=value.id,checks=checks)
