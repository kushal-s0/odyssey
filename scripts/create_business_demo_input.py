"""Create one fictional, text-layer business PDF for an end-to-end demo.

This is authored rehearsal material, not a measured model result. Existing
organizer data and quick-demo inputs are left unchanged.
"""
from pathlib import Path

from pypdf import PdfReader

from create_quick_demo_inputs import write_pdf

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'input/quick-demo/office-tea-complete-demo-en.pdf'
SOURCE = (
    'My business idea is Morning Cup, a proposed tea stall serving office workers '
    'in Hinjawadi Phase 1, Pune, Maharashtra, India. '
    'I have not started regular operations. '
    'Workers have short morning breaks and sometimes wait in queues for tea. '
    'I would offer tea with pre-order pickup and reusable-cup discounts. '
    'I spoke to 30 workers: 18 would consider buying, 8 preferred existing stalls '
    'and 4 were unsure. '
    'There are no confirmed orders or advance payments. '
    'Three existing tea stalls serve the area at similar prices. '
    'My proposed difference is scheduled pickup, but customers have not yet '
    'tested it or confirmed that they value it. '
    'I can prepare tea and handle payments, and plan to hire one helper. '
    'I need tea leaves, milk, sugar, drinking water and paper cups. '
    'A local dairy and wholesale grocery shop are potential suppliers, but '
    'prices and supply agreements are not confirmed. '
    'Startup investment is INR 60000 for equipment, a deposit and opening stock. '
    'Own funds are INR 20000 and requested loan is INR 25000. '
    'The loan is not approved and I have no other funding committed. '
    'The selling price is INR 20 per cup. '
    'I estimate selling 60 cups per day for 25 operating days per month. '
    'Estimated revenue is INR 30000 per month. '
    'Variable cost is INR 8 per cup, or INR 12000 per month at these sales. '
    'Monthly fixed costs are rent INR 10000, helper wages INR 7000, '
    'transport INR 3000 and utilities INR 2000. '
    'Total expenses are INR 34000 per month, giving an estimated operating '
    'loss of INR 4000 per month before tax and borrowing costs. '
    'I have not confirmed site permission, loan terms or food-business registration. '
    'I want mentoring to test customer demand, secure permission and funding, '
    'and revise the cost and sales plan before opening.'
)


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    write_pdf(TARGET, SOURCE)
    reader = PdfReader(TARGET)
    assert len(reader.pages) == 1, 'Demo input should stay on one page'
    extracted = reader.pages[0].extract_text()
    assert extracted.split() == SOURCE.split(), 'PDF must preserve the entire proposal'
    # Authored arithmetic only, not model inference or an accuracy benchmark.
    assert 20 * 60 * 25 == 30000
    assert 8 * 60 * 25 + 10000 + 7000 + 3000 + 2000 == 34000
    assert 30000 - 34000 == -4000
    assert 60000 - 20000 - 25000 == 15000
    print(f'Created {TARGET.relative_to(ROOT)}: one page, {len(SOURCE.split())} words; exact text preserved.')


if __name__ == '__main__':
    main()
