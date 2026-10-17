from decimal import Decimal

from app.contracts.models import EvidenceField, Money
from app.domain.economics import economics
from test_contracts import assessment


def amount(value, number, period='month', currency='INR', unit=None):
    return EvidenceField[Money](value=Money(amount=Decimal(number), currency=currency, period=period, unit=unit),
                                status='present', source_segment_ids=[value.evidence[0].id])


def test_tea_sales_are_revenue_never_profit_and_missing_costs_stay_unknown():
    value = assessment()
    value.evidence[0].english_text = 'I sell 120 cups per day for 25 days per month.'
    value.business.unit_price = amount(value, '10', period='unknown', unit='cup')
    result = {c.kind:c for c in economics(value).checks}
    assert result['revenue'].calculated_amount == '30000.00'
    assert result['revenue'].formula == '120 × 10 × 25 = 30000.00'
    assert result['profit'].status == 'needs_clarification'
    assert value.business.profit.value is None


def test_decimal_funding_profit_mixed_period_and_unknown_currency():
    value = assessment()
    value.business.investment = amount(value, '20000.25', 'once')
    value.business.own_funds = amount(value, '10000.10', 'once')
    value.business.requested_loan = amount(value, '10000.15', 'once')
    value.business.revenue = amount(value, '30000', 'month')
    value.business.expenses = amount(value, '120000', 'year')
    value.business.profit = amount(value, '30000', 'month')
    result = {c.kind:c for c in economics(value).checks}
    assert result['funding'].status == 'consistent'
    assert result['profit'].status == 'discrepancy' and result['profit'].calculated_amount == '20000.00'
    value.business.expenses = amount(value, '500', 'day')
    assert next(c for c in economics(value).checks if c.kind == 'profit').status == 'needs_clarification'
    value.business.requested_loan = amount(value, '10000.15', 'once', currency='unknown')
    assert economics(value).checks[0].status == 'needs_clarification'


def test_conflicting_quantities_and_translation_uncertainty_do_not_generate_revenue():
    value = assessment()
    value.business.unit_price = amount(value, '10', 'unknown', unit='cup')
    value.evidence[0].english_text = '120 cups per day or 200 cups daily for 25 days per month.'
    assert next(c for c in economics(value).checks if c.kind == 'revenue').status == 'needs_clarification'
    value.business.revenue = amount(value,'30000')
    value.business.expenses = amount(value,'10000')
    value.evidence[0].english_text = '120 cups per day for 25 days per month.'
    value.evidence[0].translation_uncertain = True
    assert next(c for c in economics(value).checks if c.kind == 'revenue').status == 'needs_clarification'
    assert next(c for c in economics(value).checks if c.kind == 'profit').status == 'needs_clarification'
