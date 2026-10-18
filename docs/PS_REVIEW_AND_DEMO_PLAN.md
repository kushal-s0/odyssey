# Problem-statement review and the shortest useful improvement plan

18 October 2026, Asia/Calcutta. Based on the supplied Tata STRIVE brief, the
[recorded evaluation](IMPLEMENTATION_AND_MODEL_EVALUATION.md), and the actual
application. The evaluation describes its original code/runtime; subsequent UI
improvements below do not change those measured model results.

## Honest verdict

**Useful as a mentor's first-review assistant; not validated for automatic
business rejection, loan approval or prediction of success.** It brings original
submissions, structured facts, questions, arithmetic and comparison tools into
one private workspace. That can help an assessor understand a proposal and
decide what to ask next. We have not measured assessor time saved or real
livelihood outcomes, so those benefits remain hypotheses for a pilot.

The largest remaining gap is judgment quality. The recorded evaluation found
overly generous ratings for weak demand/funding cases, missed facts and a
translation that omitted a loss clause. A valid JSON response with correct
source references can still contain a poor business judgment. Improving colors
or completing more infrastructure tasks cannot establish that quality.

## Against the actual problem statement

| Organizer requirement | What works | How close / limitation | Priority |
| --- | --- | --- | --- |
| Text, audio and PDF submissions | Private admission, retained originals, digital text, scan and speech adapters | Functionality implemented. Real handwriting, noisy speech and regional meaning are not reliably validated. | High: show originals and review flags |
| Identify language; translate to English; retain original | Detector, NLLB translation, original/English evidence | Tiny language challenge passed; one tested translation omitted a financially important loss clause. | Critical before consequential decisions |
| Extract business, customers, location and money | Structured fields, evidence links, unknown/conflict states | Recorded money matches 31/34; Hindi customers and rough-English investment were missed. | High: confirm facts with applicant |
| Reasoned initial ratings, strengths, gaps and risks | Six dimensions, reasons, separate completeness and arithmetic | Negative grading remains unreliable. Numerical score must not be treated as a decision. | **Highest** |
| Similar beneficiary ideas | Authorized MiniLM/pgvector retrieval | Four curated queries are encouraging; real-submission relevance has no reviewed benchmark. Empty view is honest when no neighbors exist. | Demonstrate when indexed records exist |
| Nearby-business context | Confirmed-area OpenStreetMap lookup, date/attribution/outage state | Map coverage is incomplete, especially informal businesses; no listings does not mean no competitors. | Useful supporting context |
| Consolidated assessor view and four comparisons | Review queue, evidence, clarifications, domain/trade/cohort/across-cohort charts | Implemented; comparisons inherit grading limitations and must show sample sizes. | Demonstrate existing flow |
| Accessible regional-language experience | English/Hindi interface; regional input language remains a separate choice | Menus/guidance switch without discarding drafts. Saved model prose and original sources retain their languages. Other interface languages and human fluency review remain future work. | Completed in this sprint |
| Preferably real time and scalable | Durable background jobs, progress, saved results | Recorded short text p50 60.698s / p95 110.163s on this RTX3050; one GPU job at a time and queue time additional. No real-time or public-scale claim. | Set expectations |

This is substantially closer to a **presentable local assisted-review demo**
than to a trustworthy autonomous screening service. A percentage such as
“90% complete” would hide the importance of the remaining semantic failures.

## Four work packages for the two-hour window

These are changes to existing tasks, not four new backlog items. Estimates were
planning timeboxes, not promises of new model accuracy. No model evaluation is
rerun in this sprint.

| Order | Work / existing tasks | Timebox | Delivered behavior |
| --- | --- | --- | --- |
| 1 | English/Hindi interface — T08/T13/T16/T17 | 30 min | Persistent language selector, translated navigation/auth/forms/guidance/chart labels, stable drafts and original text |
| 2 | Review summary and rubric explanation — T03/T12/T18 | 25 min | Financial loss, funding shortfall and mismatched amounts appear ahead of scores; uncertainty routes to clarification; inline six-dimension rubric |
| 3 | Upload completion/recovery — T06 | 20 min | Expired upload responses retain HTTP status, safe retry keys, stop waiting without losing the selected file, discard unattached uploads, HTTP204 support |
| 4 | PS review, concise summary, safe cleanup and checkpoint | 20 min | This review, one-page summary, updated reports/status, disposable cache cleanup |
| Reserve | Focused software/browser checks and local restart | 25 min | Validate changed behavior; preserve accounts, active work and model measurements |

The review summary uses **existing saved arithmetic**. It does not rewrite
historical ratings or claim the LLM now correctly classifies negative businesses.
The workspace response includes the arithmetic from the same saved assessment,
without another SQL query, provider call or inference job.

## What T03's “rubric” means

Rubric means an explicit assessment guide. Our proposed six dimensions are:

| Dimension | Weight | Main question |
| --- | --- | --- |
| Business clarity | 15% | Is the offer, customer and operating model understandable? |
| Customer need | 20% | Is the need supported by the supplied customer evidence? |
| Market potential | 20% | Is there a reachable market and credible demand evidence? |
| Feasibility | 25% | Do resources, funding, supply and economics make sense? |
| Competition | 10% | Are alternatives understood and addressed? |
| Differentiation | 10% | Is there a customer-relevant reason to choose this offer? |

Each assessable dimension receives 0–4. Zero requires evidence of weakness;
missing, unreadable or conflicting information remains unrated. The total is
`100 × Σ(weight × rating / 4) / Σ(assessed weights)`. Completeness counts usable
fields separately. Coverage below70%, critical conflicts and source-review
flags can withhold the headline; ranking also requires all six dimensions.

**50/100 is not a50% success probability.** The guide is project-proposed, not
an official Tata STRIVE scoring formula or an externally calibrated predictor.
See [the full rubric](RUBRIC.md), also now explained inside the result page.

## Why tasks said “blocked”

The tracker combines implemented features with their original engineering and
validation gates. “Blocked” often meant **working feature, unfinished acceptance
evidence**, rather than “no code exists.” “Done” likewise does not imply the
model has proven accuracy on real entrepreneurs.

| Category | Tasks / examples | Meaning and action |
| --- | --- | --- |
| Model-quality evidence | T09/T10/T11/T14/T20 | Human translations/transcripts/business labels or real retrieval relevance are missing or failures remain. Keep these limitations visible; do not relabel as done. |
| Hosted/access/operational evidence | T04/T05/T07/T13 | Features have local/historical live checks, but the full hosted cohort, recovery or runtime matrix is incomplete. Continue the local demo with these boundaries. |
| Publication/deployment | T23/T23A/T24/T25/T26/T27 | Packaging/docs/local behavior are not a verified public deployment. Publication still needs explicit approval. |
| T06 specifically | Uploads and submission API | Its written checks require intact formats/11-page scans, invalid/cross-user rejection and duplicate safety. Those pass in the existing corpus checks and current focused software checks; historical real Supabase PDF byte integrity also passed. T06 is complete against those criteria. The broader hosted interruption/recovery exercise remains a T25 deployment check. |

The current tracker therefore has13/29 done after the T06 correction, while the
frozen evaluation's12/29 remains an accurate historical snapshot. Neither count
is a percentage of usefulness or model accuracy.

## The next minimum plan after this demo

1. **Calibrate first-review decisions on reviewed English/Hindi cases.** Have a
   business mentor label a small balanced set covering strong, weak, uncertain,
   conflicting and unrealistic claims. Prioritize negative demand, recurring
   losses and funding gaps. Improve extraction/rating rules with versioned
   expectations; measure abstention and false optimism, not just average scores.
   The current sprint's warnings reduce presentation risk; they do not solve
   semantic grading. This needs reviewer availability and cannot honestly be
   guaranteed inside the two-hour window.
2. **Repair meaning preservation at the source.** Review financially important
   negations, periods, customer descriptions and representative handwriting/
   speech in the same cases. Correct via the existing versioned review flow.
   Keep other languages unvalidated until fluent reviewers are available.
3. **Rehearse and deploy the verified assisted workflow.** Use existing saved
   results for the presentation, inspect originals, explain a financial warning,
   ask a clarification, then show similarity/context/comparisons when real data
   exists. After explicit publication approval, verify the actual free hosting,
   owned-worker availability and hosted recovery. No new platforms or retraining
   the rejected relevance classifier are prerequisites for this local demo.

## A short, honest demonstration

Use the coordinator-provided account; do not expose passwords or `.env` files.
Switch English/Hindi, open a saved result, show the original and extracted facts,
then the review summary, rubric, financial checks and next question. Use an
already-processed weak example to discuss why the reviewer must question the
score. Show comparisons with counts; mark rehearsal records as synthetic.
Opening saved results does not require inference. If a new submission is needed,
queue it ahead of the presentation and allow additional time for scans/audio.

Say: “We help a mentor understand and investigate a proposal. The prototype keeps
sources and uncertainty visible. It does not replace the mentor's decision.”
