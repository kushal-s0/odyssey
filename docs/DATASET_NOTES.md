# Dataset inspection - T01

The original archives are preserved. Reproducible inventory: `scripts/inventory_dataset.py --decode-audio`, using `pypdf==6.1.1` and `av==16.0.1`. Output is separated into versioned technical metadata and ignored private source/text mappings.

## Verified counts

- 55 submission files: 42 PDFs, 11 audio-only MP4/AAC and two OGG recordings.
- 109 PDF pages. Four 11-page Hindi scans have no text layer; the other 38 PDFs have extractable text, some corrupted or misordered.
- All 13 recordings decoded successfully: approximately 2250.366 seconds in total. Audio decoding is not transcription or language validation.
- Folder-declared languages: English 11, Hindi 11, Marathi 11, Telugu 15, Bengali two, Odia five. These counts do not establish actual language content.
- Two complete inventory runs produced identical public manifest bytes: SHA-256 `e37ddda1aa08c24ac4048f96c23aa24ab59d478ca2939bc99db1a221e8af3814`.

`evals/manifests/dataset.json` records input/archive hashes, versions, page geometry/text hashes and decoded audio metadata. `.local/dataset-manifest.private.json` retains original paths and extracted text for authorized local inspection only. Source paths can contain beneficiary names and must not be copied to published artifacts.

## Interpretation and evaluation boundaries

File identity is different from business-family identity. The automatic family hints are unreviewed and conservative; audio families are unknown. Review and merge related translations/variants before any train/validation/test split. Folder scenario labels are not authoritative answer-level labels. The dataset has no business-success labels and cannot validate funding predictions.

Preserve missing questions/answers, implausible but on-topic claims, irrelevant replies, changed technical questionnaires, mixed scripts, overwritten alternatives and full financial tables. A Unicode replacement-character check alone misses several regional glyph-mapping failures. A normal text layer cannot prove handwriting capability.

The earlier visual review inspected the brief, all scan contact sheets and a handwritten page. This task has not yet established word-level handwritten/transcript ground truth. English/Hindi human review is available; the other languages are not human-validated.
