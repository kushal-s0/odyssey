AI-powered business idea screening — 18-hour implementation plan

Prepared on 17 October 2026. Status: implementation authorized in the subsequent request. See TASKS.md for current progress; live API verification, cloud training, and deployment depend on configured accounts.

Build a MERN application for Tata STRIVE assessors and beneficiaries, using MongoDB Atlas and cloud-hosted AI. The application will preserve original submissions, explain its assessments using evidence, and ask for clarification when information is unreliable. The distinctive feature is an Evidence Repair Loop.

**1. What the supplied problem statement actually requires**

The application is a first-level screening and mentoring aid. It must handle text, audio, and PDFs in Indian regional languages; retain the original; translate to English; extract the business proposal; rate assessment dimensions with reasons; find similar beneficiary ideas; retrieve local business context; and provide a consolidated assessor view.

It also explicitly requires domain-wise, trade-wise, cohort-wise, and across-cohort comparisons. These will be part of the MVP, rather than an optional analytics extension. Funding and livelihood decisions remain with the assessment team.

| Requirement | Planned implementation |
| --- | --- |
| Multiple input formats | Text entry, PDF upload, audio upload, browser recording; extract audio from the supplied MP4 files |
| Regional languages | English, Hindi, Marathi, Telugu, Bengali, and Odia as the initial test matrix; language correction available |
| Translation and standardisation | Original, transcript/extracted text, English translation, and structured facts stored separately |
| Core business understanding | Business/trade, products, customers, problem, location, materials, suppliers, investment, financing, prices, projected revenue, competition, and differentiation |
| Explainable assessment | Seven requested dimensions, evidence links, strengths, gaps, contradictions, and next steps |
| Similar ideas | Hosted embeddings, similarity retrieval, and visible matched products/customer groups; exclude versions of the same submission |
| Local context | Confirmed location plus sourced OpenStreetMap business listings; distinguish mapped listings from applicant claims |
| Comparison views | Business sector, trade, cohort, and across-cohort filters with group size, evidence coverage, and rubric version |
| Human review | Accept/correct extracted facts, add notes, and record a mentoring/deeper-evaluation recommendation with an audit trail |

**2. Dataset findings and their consequences**

The source folder is `AI solution for business solutions`. I read the three-page problem statement, inventoried every archive entry, attempted text extraction for all 42 dataset PDFs, and inspected representative extracted content. Audio files have been inventoried but not listened to or transcribed. Regional-language visual content and audio transcription quality still require validation during implementation.

| Archive | Samples | Languages indicated by folders |
| --- | ---: | --- |
| Form fill-ups | 23 PDFs | English 6, Hindi 5, Marathi 6, Telugu 6 |
| PDFs | 19 PDFs | English 5, Hindi 4, Marathi 5, Telugu 5 |
| Audios | 13 recordings: 11 MP4, 2 OGG | Hindi 2, Bengali 2, Odia 5, Telugu 4 |
| Total | 55 files, approximately 49.88 MiB uncompressed | Six languages including English |

The PDF dataset contains 109 pages. Four Hindi PDFs contain 11 pages each and yielded no extractable text. Other documents yield some English text but lose substantial Indic script or have broken field alignment. A nonempty text extraction must therefore not be treated as successful extraction. We need page-aware visual processing for scanned pages, missing script, tables, and overwritten answers.

Several files are variations of the same business proposal. For example, multiple English form examples concern the same tea/snacks business with changed or missing answers. Across-language examples also reuse scenarios. These are 55 files, not necessarily 55 independent businesses or training examples.

The content deliberately tests missing questions, blank answers, unrelated answers, mixed languages, conflicting answers, and overwritten values. One overwritten poultry example contains two monthly revenue values. The system should expose that conflict, not select a plausible amount.

No structured expert-rating labels or business-outcome labels were supplied in the archives. I found no explicit cohort fields in the extracted text; scanned/audio content remains unverified. Cohort membership will come from assessor-entered/imported metadata. Unknown membership stays unassigned. Any comparison demo cohorts will be clearly labelled synthetic and excluded from claims about actual programme performance.

**3. Recommended architecture**

| Component | Choice and purpose |
| --- | --- |
| Frontend | React + Vite + TypeScript; Tailwind CSS and accessible components; monochrome charts |
| Application API | Node.js + Express + TypeScript; schema validation; upload handling; assessment orchestration |
| Database | MongoDB Atlas with Mongoose |
| Original files | Atlas GridFS for the hackathon; authenticated download/streaming, file hashes, source metadata |
| Processing | Mongo-backed jobs with bounded concurrency, leases, retry limits, and progress polling; no additional Redis dependency |
| Document reading and translation | Hosted Gemini Flash API, pinned to a tested model available to the account |
| Audio | Hosted Sarvam speech-to-text because the supplied files include Odia; language-specific smoke tests before selection |
| Embeddings | Hosted Gemini embedding API; fixed model, task settings, dimension, and normalization recorded |
| Custom trained model | Small response-relevance classifier trained in a cloud notebook and exposed through a separate hosted Node inference API |
| Similarity | Atlas Vector Search if the index is ready; exact cosine search over stored vectors is sufficient for the initial 55 files |
| Local businesses | Nominatim geocoding and Overpass queries; caching, source URLs, timestamps, and attribution |
| Hosting | React static hosting and an Express-compatible Node host, such as Render; cloud model inference remains remote even during local UI development |

No LLM, speech model, embedding model, or trained classifier will run on the development laptop or in the browser. PDF parsing, audio format conversion, validation, arithmetic, and cosine calculation are ordinary processing, not local model execution. The custom model endpoint will be deployed remotely before connecting it to the development app.

Google documents visual PDF processing and schema-constrained output, which fit the extraction workflow. Schema validity still does not establish factual correctness. [Document processing](https://ai.google.dev/gemini-api/docs/document-processing), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

Sarvam documents support for the relevant Indian languages, including Odia, and separate handling for longer recordings. MP4 files will be converted to a supported audio format; long audio will use batch processing or bounded chunks with timestamp offsets. [Speech API](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), [formats and languages](https://docs.sarvam.ai/api/speech-to-text/faq).

Core collections: `users`, `cohorts`, `submissions`, `sourceSegments`, `assessments`, `clarifications`, `jobs`, `localBusinessCache`, `modelVersions`, and `auditEvents`, plus GridFS. Each assessment records source version, model IDs, prompt version, rubric version, and processing status. Identifying profile fields stay separate from scoring inputs.

API scope: create/list submissions, upload/read source files, poll processing, fetch an assessment, submit clarifications, record assessor review, retrieve similar ideas, retrieve local context, compare groups, and export a printable report/CSV.

**4. What we will actually train**

Train a regularized logistic-regression classifier on hosted embeddings of business context + question + answer. Its narrow task is to flag likely off-topic answers for review. This is genuine supervised training on your dataset; the embedding model is pretrained and accessed by API. Blank values, unreadable source, and conflicting amounts are separate validation states, not things the classifier should invent answers for.

The 55 files do not justify training an LLM, OCR system, speech model, or business-success predictor from scratch. The custom classifier will support input quality, while an explicit rubric provides the initial assessment. [Logistic regression reference](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression).

Training procedure:

1. Obtain reliable source text using extraction/transcription and human correction; remove identifiers and file/scenario names from model inputs.
2. Create question-answer records with parent file, underlying business/scenario family, language, source location, and manually reviewed relevance labels. A document labelled “irrelevant” does not imply every answer in it is irrelevant.
3. Group translated copies, revisions, and related scenario variants before splitting. All records from a family stay together. Freeze held-out families before tuning.
4. Aim for a useful labelled set from the supplied answers; count actual usable records instead of claiming that 55 files automatically produce hundreds of independent samples. If groups are too few for a reliable holdout, use grouped cross-validation and state that limitation.
5. Generate embedding features through the hosted API; train the regularized classifier in Google Colab using a prepared notebook. Colab execution requires an available signed-in cloud session. No GPU is needed for the classifier head.
6. Compare with a simple rules/similarity baseline; report macro-F1, off-topic recall, confusion matrix, group counts, and an abstention/coverage tradeoff. Check performance by language where enough labelled cases exist.
7. Export coefficients, feature configuration, training-data hash, and model version; serve predictions through the remote Node inference endpoint. Verify matching cloud-notebook and endpoint predictions on fixed vectors.
8. If measured performance is poor or labels are insufficient, still report the training experiment honestly, but keep predictions advisory and route uncertainty to review. Never claim fabricated accuracy or silently substitute an API call for a trained model.

Classifier outputs are model scores, not calibrated probabilities of factual correctness. It will not approve/reject a beneficiary or fill in missing answers.

Hugging Face data is optional. Do not add an unrelated startup-funding dataset simply to increase row count: it would not provide reliable labels for these livelihood proposals. Add external examples only after checking task match, language, licence, duplicates, and independent evaluation. This is outside the critical path for 18 hours.

**5. Controls against hallucination and extraction errors**

Zero hallucinations cannot be guaranteed by prompting, fine-tuning, a second model, or low temperature. The implementation will enforce traceability, preserve uncertainty, and test observable failure cases.

| Stage | Required control |
| --- | --- |
| Audio transcription | Preserve original audio and timestamped segments; flag unclear names, amounts, and silence; allow transcript correction before assessment |
| PDF reading | Preserve pages; detect extraction failure beyond character count; route visual/overwritten content to review; do not resolve overlapping values by guessing |
| Translation | Keep original and English side by side; preserve currencies, numeric values, negation, and place names; flag mismatches |
| Structured extraction | Fixed schema; each populated fact references a source segment; `null` plus a reason for missing, ambiguous, or unreadable values |
| Evidence validation | Backend checks source existence, quote/offset alignment where possible, schema, types, and numeric consistency; an OCR quote remains an unverified transcription until checked |
| Source interpretation | Applicant-stated facts, externally sourced facts, model interpretations, and assessor-confirmed facts carry different labels |
| Assessment | Deterministic rubric arithmetic; evidence attached to criteria; insufficient evidence produces “Not assessable” instead of an invented score |
| Similarity | Retrieve only actual accessible submissions; show matched content; similarity never establishes the truth of another proposal |
| Local insights | Display only returned listings and their sources; no results means “No mapped results found,” never “No competitors” |
| Untrusted input | Uploaded instructions are treated as submission content; they cannot change the rubric, reveal other records, or invoke arbitrary tools |
| Verification | Recheck disputed/high-impact fields; model disagreement triggers clarification, not a majority-vote assertion of truth |
| Failure handling | API timeout, invalid output, missing evidence, or quota exhaustion produces a retriable/review state, not a completed fabricated report |

Revenue remains explicitly projected when it comes from the beneficiary. Profit is not inferred from revenue without costs. Any derived amount shows the formula and its cited inputs. A statement about surveyed customers is recorded as an applicant claim unless independently verified.

A citation proves traceability, not truth. Test both whether citations resolve and whether the cited material actually supports the displayed claim. LLM-generated confidence percentages will not be shown as factual certainty.

**6. Assessment and comparison rules**

All seven dimensions requested by the problem statement will be visible: clarity, customer need, market potential, feasibility, competition, differentiation, and completeness. Each uses a short, versioned rubric with 0–4 anchors and supporting evidence. Unknown is distinct from zero.

Keep three outputs separate: provisional idea assessment, information completeness, and evidence/review status. Poor OCR or a missing answer is not proof of a poor business. Language, grammar, gender, caste/category, and personal education will not be scoring features; actual business capabilities explicitly supplied can inform feasibility.

For a provisional aggregate, use configurable initial weights across the six business dimensions: clarity 15%, customer need 20%, market potential 15%, feasibility 25%, competition 10%, differentiation 15%. Show completeness independently. These are proposed product rules, not weights learned or validated from this dataset. Reweight only assessed dimensions, show the assessed weight coverage, and withhold the aggregate below an initial 70% coverage gate or when critical conflicts remain. The threshold is configurable and must be tested.

Market potential is an evidence-based preliminary assessment of the proposal. Mapped competitors do not establish market size, profitability, demand, or market saturation. When relevant information is absent, leave this dimension unassessed.

Compare records only under compatible rubric versions and similar evidence coverage. Sector/domain and trade are separate grouping fields. Cohort views show count, median dimension scores, completeness, and review state. Do not present small-group percentiles as meaningful; an initial minimum of five comparable ideas is a display rule, not statistical validation. Deduplicate revisions and disclose demo-only group assignments.

**7. Distinctive feature: Evidence Repair Loop**

Instead of stopping at “your application is incomplete,” offer up to three targeted questions about the most consequential unresolved fields in the beneficiary's chosen language. Questions come from known gaps/conflicts and the rubric; they do not contain guessed answers.

Example: an overwritten source contains projected monthly revenue of both Rs. 20,000 and Rs. 60,000. The system highlights the page, asks which amount is intended and whether it refers to sales or profit, accepts a text/audio response, and stores that response as new evidence. It then recalculates affected criteria and shows a before/after explanation linked to the clarification.

The assessment may increase, decrease, or become assessable after clarification. This feature must not coach users to inflate scores. The original submission and all assessment versions remain available. Assessors can see exactly which evidence changed and why the result changed.

**8. Interface plan**

White backgrounds, black primary text/buttons, neutral gray borders and secondary text, restrained spacing, and readable typography. No bright accent palette, gradients, decorative dashboard clutter, or colour-dependent status cues. Statuses use text, icons, border styles, and grayscale patterns. Use appropriate script fonts and readable sizing for Indian languages.

Five focused screens:

1. **Submit idea:** text / record or upload audio / upload PDF, language selection, cohort metadata when known, and a simple processing progress indicator.
2. **Assessment inbox:** searchable table with beneficiary, trade, cohort, input type, completeness, assessment status, and next action.
3. **Assessment detail:** original document/audio and evidence on one side; structured idea, dimensions, strengths/gaps, similar ideas, and local context on the other. Show uncertainty next to the affected field.
4. **Clarification:** short questions with text/audio responses and the assessment change history.
5. **Comparisons:** sector/trade/cohort filters and accessible monochrome tables/bars. Include CSV and print-to-PDF export.

The beneficiary flow works on mobile; detailed assessment is optimized for desktop. Assessors can expand evidence progressively rather than reading a long AI essay. No generic chatbot is needed for the MVP.

**9. Local business insights**

Geocode only the business location, not contact details. Ask for location confirmation when multiple villages share a name; use a manually set point if needed. Never search around an assumed location. Query configured trade-to-OSM categories within an explicit radius and show source, retrieval date, and location precision.

Public Nominatim requires an identifying user agent, attribution, caching, and at most one request per second. Do not use it for autocomplete or indiscriminate bulk geocoding. Use explicit lookup requests. Overpass results depend on what is mapped and on public service availability. Cache results and show a clear unavailable state on failure. A sourced list is sufficient for the MVP; an interactive map is optional. [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API).

**10. Proposed 18-hour execution schedule**

Times are elapsed implementation hours after plan acceptance; account/key setup and a signed-in cloud training session need to be available at the start. This is an MVP timebox, not a promise of production readiness.

| Hours | Deliverable and exit condition |
| --- | --- |
| 0–1 | Scaffold MERN, Atlas connection, secret configuration, provider smoke tests, initial hosted model-service shell; one request succeeds for each required provider |
| 1–3 | Uploads, GridFS retention, durable jobs, source viewers, text/PDF/audio ingestion; one sample per format reaches a reviewable transcript |
| 3–6 | Visual PDF fallback, translation, evidence schema, numeric/conflict checks, rubric engine; representative valid/missing/irrelevant/overwritten cases behave correctly |
| 6–8.5 | Label usable answer pairs, grouped split, cloud classifier training, metrics, remote inference; save real training artefacts and connect advisory predictions |
| 8.5–11 | Complete assessor UI, source links, corrections, and Evidence Repair Loop; demonstrate one evidence-backed assessment revision |
| 11–13 | Similar-idea retrieval and sourced local business listings; exclude same-submission versions and handle uncertain geocoding |
| 13–14.5 | Trade/domain/cohort comparison views and report export; unknown and synthetic metadata remain visibly distinguished |
| 14.5–16.5 | End-to-end checks, held-out evaluation, input isolation, API failures, and language review; fix failures rather than adding features |
| 16.5–18 | Deployment checks, seeded demo, README, model results/limitations, and presentation walkthrough; retain a buffer for integration issues |

Cloud requests can process asynchronously while UI work continues. If time tightens, cut map visualization, advanced charts, external dataset augmentation, and extra provider integrations first. Retain the required input formats, seven assessment dimensions, comparisons, evidence controls, real training experiment, and the clarification feature.

**11. Validation and demo acceptance**

- Text, typed PDF, scanned PDF, MP4, and OGG produce either an evidence-linked assessment or an actionable clarification/failure state.
- Each represented language gets a smoke test; transcription/translation accuracy is reviewed by someone competent in that language where available. Untested quality is disclosed.
- Missing answers remain missing; unrelated responses do not become business facts; overlapping revenue amounts trigger clarification.
- Identical saved evidence and rubric produce identical numeric aggregation. Correcting extraction or evidence creates a new version.
- Every displayed factual claim has a resolvable source reference. No unsupported claims are accepted in the audited release examples; this finite test is not a universal zero-hallucination guarantee.
- Similarity results are judged against manually identified similar/different business pairs. Retrieval scores are not labelled probabilities.
- No local listings, ambiguous locations, quota failures, silence, and unreadable PDFs all receive explicit states.
- Grouped model evaluation prevents translated/revised copies crossing the split. Report real results, abstentions, and sample counts rather than an invented target accuracy.
- Cohort comparisons use entered/imported membership or visibly labelled demo data; the AI cannot invent programme cohorts.
- Beneficiaries cannot read other beneficiaries' source files. API secrets stay server-side; uploaded documents cannot override assessment rules.

Suggested judge demonstration: submit a regional-language idea; open its original evidence and English structure; inspect dimensions and a similar submission; show sourced local context; repair a conflicting/missing answer; explain the assessment change; finish with a trade/cohort comparison and the trained classifier's measured results.

**12. Accounts, costs, and practical dependencies**

Needed before implementation integration: MongoDB Atlas URI, Gemini API key, Sarvam API access, a cloud notebook session for training, and a deployment account. Configure secrets through ignored local environment files or host secret settings, not in chat or committed source. The trained endpoint needs its own URL and service token.

Use available free allowances first, but verify actual account quotas at the first milestone. Gemini lists free access to selected models and embeddings, with free-tier content potentially used for product improvement. Use organizer-approved demo data and remove identifiers from text model inputs; scanned documents/audio may still contain identifiers, so provider handling must fit the dataset's permission. [Gemini pricing and data-use distinctions](https://ai.google.dev/gemini-api/docs/pricing).

Sarvam advertises signup credits, which are finite rather than an unlimited free service. [Speech service](https://www.sarvam.ai/speech-to-text). Google Colab offers free cloud compute with variable availability; use it for interactive training, not as a permanently hosted inference server. [Colab FAQ](https://research.google.com/colaboratory/intl/en-GB/faq.html).

Render offers free deployment with idle shutdown/cold starts and usage limits. Use Atlas for persistent uploads and job state, and open the demo ahead of presentation to check readiness. [Render free service limits](https://render.com/docs/free). Atlas storage/index quotas must be checked, including GridFS and index overhead; the original dataset itself is about 50 MiB. [Atlas free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

Do not assume a new Hugging Face CPU Space is universally free to create: current documentation describes account-plan restrictions despite CPU Basic having no hourly compute price. It remains an optional host if the account is eligible. [Spaces documentation](https://huggingface.co/docs/hub/spaces-overview).

No paid resource will be purchased as part of accepting this plan. If free allowances cannot support the required demo, surface the measured limitation and concrete low-cost option before enabling billing.

Implementation was authorized in the next instruction. The design decisions remain the narrow cloud-trained relevance model, evidence-based assessment, the Evidence Repair Loop, and the required external service access. Execution status is tracked in TASKS.md.
