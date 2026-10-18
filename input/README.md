# Judge rehearsal inputs

18 input files: 8 text proposals (English/Hindi), 4 digital PDFs, 2 image-only scanned PDFs, 3 English synthetic speech WAVs and 1 silent WAV. Every business is fictional. Positive means usable supplied detail; negative means missing, conflicting, irrelevant or adversarial input, not a prediction about an entrepreneur.

1. Start the app with `start.cmd` and sign in normally with Supabase.
2. Select **Synthetic rehearsal input** when submitting these examples. Use the family identifier from the expected JSON for text/PDF/audio variants of the same idea. Synthetic records are excluded from ordinary population comparisons; deliberately enable labelled examples to demonstrate charts.
3. Paste a file from `text/`, or upload a file from `pdf/` or `audio/`. Choose English or Hindi as indicated by the filename. Do not paste the answer key into the input.
4. Compare the result with `expected/<case-id>.json`. Files under `audio/` also have reference transcripts. Check actual extraction, original evidence, figures and uncertainty before discussing the result with judges.

Suggested sequence: positive tea text -> conflicting-price PDF -> incomplete Hindi text -> tea audio -> image-only tea scan -> clarification -> assessor review -> graph comparisons -> Groq explanation -> report export. Queue one model example at a time and measure its actual latency. A scanned typed page exercises OCR, not handwriting quality. Synthetic clean English speech does not establish real regional-audio accuracy. Silence may correctly yield an actionable no-speech failure or needs-review result; it must not yield invented facts.

The tea sample supplies INR 10/cup, 120 cups/day and 25 operating days/month: planned revenue is INR 30000/month; with stated expenses INR 22000/month, the arithmetic difference is INR 8000/month. These are assumptions from a fictional applicant. The negative price case deliberately leaves INR 10 versus INR 15 unresolved and funds of INR 30000 versus investment INR 20000 inconsistent. Keep the INR 90000 profit claim unverified.

Expected files distinguish authored source facts, derived arithmetic, unknowns, conflicting values and review requirements. They contain no model accuracy score, guaranteed model output, calibrated confidence percentage, real market evidence or guaranteed rating. Hindi human review is pending. Graphs and confidence panels must preserve that distinction. Original organizer datasets are untouched.

Rebuild with a Python providing reportlab/PyMuPDF/Pillow: `python scripts/create_judge_samples.py`. It uses local Windows SAPI speech; no API, credentials, download or account required. If Windows execution policy blocks the speech helper, run the reviewed local `scripts/generate_sample_audio.ps1` with an allowed process policy, then `python scripts/create_judge_samples.py --reuse-audio`. No machine policy change is needed. `manifest.json` contains SHA256 hashes and byte counts.
