# Udyam Saathi — quick explanation and measured limitations

**Purpose:** help Tata STRIVE mentors give a consistent first review to a
business idea, including ideas expressed through regional text, PDF or voice.
It is useful for organizing evidence and follow-up; it is not validated for
automatic funding decisions or predicting business success.

**How it works:** Supabase login → private original submission → durable local
worker → text/OCR/speech → language identification and English translation →
Qwen's structured facts and proposed ratings → server arithmetic → human review,
clarifications, similarity, local context and comparisons. Originals and earlier
versions remain traceable. React/FastAPI/Supabase and pretrained open-weight
models supply these functions; the foundation models were not trained by us.

**Now in the website:** English/Hindi menus and guidance; persistent language
choice and drafts; a review summary before the score; visible operating losses,
funding gaps and unresolved facts; an explanation of the six-part rubric; safer
upload interruption/retry/discard. The summary reuses existing saved facts and
financial checks. It does not change old scores or improve measured LLM accuracy.

**Processing repair:** fixed an observed worker/database deadlock and lease retry
loop, extended visible progress tracking beyond five minutes, exposed stage
counts and batched cheap English passthrough writes. Short fictional examples
are in [quick-demo](../input/quick-demo/README.md). See the
[timing explanation](PROCESSING_TIME_AND_RECOVERY.md); the optimized average has
not yet been measured, and the latest affected PDF is already completed4/4.

## Existing model results — no inference rerun for this summary

| Component | Previously measured result | What it means |
| --- | --- | --- |
| Full business scenarios | 13/14 completed;89/99 checks passed (89.9%);8/14 cases passed every check | Small authored challenge, **not overall business-success accuracy** |
| Money extraction | 31/34 amount/currency facts matched (91.2%) | Missed facts/periods still matter; verify against the original |
| Negative-domain judgments | 0/4 weak-domain expectations actually received low ratings;1 abstained and3 overrated | The largest quality weakness; human demand/feasibility review required |
| Qwen/end-to-end time | p50 60.698s; p95 110.163s | This RTX3050 and these text cases; queue/audio/scan time additional |
| Language identification | 13/13 expected decisions;11 automatic and2 short-input abstentions | Tiny challenge, not general multilingual accuracy |
| NLLB translation | chrF++71.62; numbers preserved in10/10 cases | Lexical/reference metric; one translation omitted a loss clause |
| MiniLM similarity | Recall@5 100% over4 queries/10 candidate ideas | Encouraging tiny gallery; no real-corpus relevance claim |
| PaddleOCR | 0% character/word error over3 synthetic rendered images | Not a genuine handwriting benchmark |
| Whisper English | 6.52% word error over3 synthesized clips | Clean synthetic speech; not regional/noisy-speech accuracy |
| Odia speech | Actual inference ran; no reviewed transcript | Accuracy unknown |
| Experimental relevance classifier | 50% on16 QA examples; all predicted relevant | Rejected for serving; not our business assessment model |

There is **no defensible single “our model is X% accurate” number**. Business
success labels and independent original-corpus review are missing. The most
important failures are documented rather than hidden by an average.

**T03** is the proposed rubric: clarity15%, need20%, market20%, feasibility25%,
competition10%, differentiation10%; each rated0–4. Unknown does not mean zero.
Completeness is separate, and50/100 does not mean50% success.

**Task status:** T06 uploads/submissions meets its written acceptance checks.
Other blocked entries usually indicate incomplete quality, hosted validation or
deployment evidence, even when the feature exists. No public deployment is
claimed. Best next investment: mentor-reviewed English/Hindi negative/unknown
cases, then source-meaning fixes and an approved deployment rehearsal.

See [PS review and four-package plan](PS_REVIEW_AND_DEMO_PLAN.md) and the
[full existing evaluation](IMPLEMENTATION_AND_MODEL_EVALUATION.md) for examples,
denominators, implementation details and evidence.
