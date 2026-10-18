# Start here for a short demonstration

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
