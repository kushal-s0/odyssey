# Start here for a short demonstration

## One detailed PDF for the main application walkthrough

Upload **office-tea-complete-demo-en.pdf**, select English and **Synthetic
rehearsal input**, and use scenario family `office-tea-complete-demo`.
This is a fictional one-page digital PDF, with no scan/OCR overhead. It includes
all main business-information groups: offer, customers, demand, location,
competition, differentiation, resources/suppliers, operating stage and finances.

Authored facts to check in the result (not newly measured model outputs):

| Item | Expected interpretation |
| --- | --- |
| Customer research | 18/30 would consider buying, but there are no confirmed orders. This is self-report, not verified demand. |
| Operating result | INR 30,000 revenue minus INR 34,000 expenses = **INR 4,000 monthly loss**. |
| Startup funding | INR 60,000 investment minus INR 20,000 own funds and INR 25,000 requested loan = **INR 15,000 gap even if the loan is obtained**. The loan is not approved. |
| Clarification opportunities | Loan approval/terms, site permission, supplier prices, food-business registration and whether customers value pickup. |
| Scenario planner | Price 20; variable cost/unit 8; daily units 60; operating days 25; fixed costs 22,000; startup 60,000. Base loss 4,000/month; at 20% fewer sales, loss 7,600/month. Break-even needs at least 1,834 cups/month. |

Use the result to show evidence/source links, the first-review warning, rubric,
business map, scenario planner, clarifications, assessor review, versions and
report export. Confirm the coarse Pune area before nearby-business lookup.
Similar ideas need other authorized indexed records; comparisons need eligible
records and their counts. Synthetic inputs are excluded from ordinary charts
unless explicitly included. A single PDF cannot demonstrate audio capture or
validate translation; those require separate inputs. The interface can still be
switched between English/Hindi. A model score may remain too optimistic; follow
the explicit loss/gap evidence rather than promising a low rating.

Regenerate only this PDF with
`.venv/Scripts/python.exe scripts/create_business_demo_input.py`.

## Four shorter inputs

These four fictional files contain two short ideas in text/PDF formats. Select
**Synthetic rehearsal input**, choose English and submit **one at a time**.
Use `quick-tea-positive` / `quick-tea-loss` as scenario-family identifiers for the
matching text/PDF versions. Start with text for the least document overhead.

| Example | Meaning / expected facts and arithmetic |
| --- | --- |
| `tea-positive-en.txt` / `.pdf` | Tea for office workers in Pune; some self-reported interest, no confirmed orders. Startup ₹20,000 = own ₹12,000 + requested loan ₹8,000. Monthly revenue ₹30,000 − expenses ₹22,000 = ₹8,000 operating surplus. No verified profit or success probability. |
| `tea-loss-en.txt` / `.pdf` | Negative demand evidence, existing alternatives and no advantage. Startup ₹50,000 − stated funding ₹1,000 leaves a ₹49,000 gap. Monthly revenue ₹20,000 − expenses ₹28,000 = ₹8,000 loss. These risks should be prominent even if a model score is too generous. |

The PDFs have a real text layer and no decorative instructions, unused form
cells or embedded scans. They preserve the entire companion paragraph, wrapped
for reading. This reduces avoidable segmentation/model batches; it does not
change the model, trim a genuine applicant's answers or skip OCR on scanned data.
Shorter inputs are not proof of improved accuracy or a latency guarantee.

The original18 rehearsal files and the organizer corpus are retained, including
hard/scan/audio examples. Use the original Hindi text for a regional-input demo;
interface language and submission language are separate choices. Keep the full
evaluation's recorded failures visible. No new model evaluation was run to
create these files. `manifest.json` stores hashes and authored arithmetic checks;
regenerate with `.venv/Scripts/python.exe scripts/create_quick_demo_inputs.py`.
