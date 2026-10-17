# Free deployment and model implementation specification

**User constraint:** no paid API dependencies; deploy without purchasing hosting, subscriptions, inference credits or GPUs.  
**Account context:** the user confirmed an eligible Hugging Face account for free ZeroGPU hosting. Actual account provisioning and quotas still require verification.  
**Status:** plan only, checked against official documentation on 17 October 2026.

**Latest user decisions:** deployed demo by **18 October 2026, 06:00 Asia/Calcutta**; prefer inference without expiring provider allowance. Kartik can keep his RTX 5050 laptop online. The preferred judging profile is therefore a verified owned-laptop worker, with free HF deployment retained as a separate target. Available human review is English/Hindi only. See [deadline plan](HACKATHON_DELIVERY_PLAN.md) and [handoff](SESSION_HANDOFF.md). No application/model has been executed or deployed by the planning revision.

This specification replaces the paid-provider and hosted-worker assumptions in earlier versions of the plan. It adds T09A (train a small project-specific model) and T23A (package and deploy versioned models), bringing the ordered backlog to **28 tasks**. Every task still requires its own completion Markdown report.

## 1. Selected free deployment

| Component | Selected service/runtime | Boundary |
|---|---|---|
| Frontend | React/Vite static build on Cloudflare Pages Free, using its supplied HTTPS domain | No model weights or secrets in frontend assets |
| API | Lightweight FastAPI on a Render Free web service | Authentication, metadata, durable job dispatch; no PyTorch/model weights here |
| Persistence | Supabase Free: Postgres, Auth, private Storage and pgvector | Stay within free storage/egress/connection allowances; no paid add-ons |
| Durable jobs | Postgres job/stage tables, atomic leases and publication keys | No separate hosted Redis or paid background worker |
| Preferred judging inference | Owned RTX 5050 laptop worker, after measured model-fit/recovery checks | Outbound authenticated HTTPS claim/checkpoint; no provider daily inference quota; requires laptop uptime/network |
| Secondary model runtime A | User-owned Hugging Face Gradio ZeroGPU Space: text/document inference, embeddings and custom classifier | Separately verified bounded stages; public source must contain no beneficiary data |
| Secondary model runtime B | User-owned Hugging Face Gradio ZeroGPU Space: regional speech and translation | CPU ONNX speech path; PyTorch GPU translation functions where supported; separate deployment evidence |
| Nearby businesses | OpenStreetMap-derived data via bounded Overpass requests; explicit user-triggered Nominatim geocoding if needed | Sparse coverage, attribution, cache and strict shared rate limits |

This architecture uses free service APIs and our own model endpoints; it does not purchase model inference. It supports a limited hackathon deployment. More production capacity requires additional donated, owned or funded hardware; unlimited capacity and continuous availability are not part of a free-tier claim.

The preferred model path runs on owned hardware, not on expiring trial credits. It has no provider request/day allowance but is bounded by hardware, power and internet. Cloudflare/Render/Supabase still impose free-plan caps and sleep behavior. Model fit on the observed 8151 MiB VRAM and 24,841,998,336 bytes system memory has not been measured; start with one GPU stage and bounded image/context/output sizes. Pin a compatible CUDA/PyTorch environment before inference. Never assume all candidate models fit simultaneously or promise a fully cloud-hosted service when the laptop is required.

Official limits to verify during T01/T23:

- Hugging Face permits eligible free personal accounts to host up to two Gradio ZeroGPU Spaces. Ordinary new Gradio/Docker compute Spaces otherwise require a paid plan; do not assume a free Docker Space is available. [Spaces overview](https://huggingface.co/docs/hub/en/spaces-overview)
- ZeroGPU is Gradio-specific, shared and quota-limited. GPU work must use supported PyTorch functions with `@spaces.GPU`; an ONNX GPU server or persistent CUDA daemon is not an equivalent deployment. [ZeroGPU documentation](https://huggingface.co/docs/hub/en/spaces-zerogpu)
- Its current usage table lists **five GPU minutes for a free account**, resetting 24 hours after first GPU usage. Measure actual server-token quota attribution; two Spaces do not establish two budgets. Run corpus evaluation on owned hardware and reserve available HF quota for bounded live deployment checks. A midnight reset must not be assumed. [ZeroGPU quota](https://huggingface.co/docs/hub/en/spaces-zerogpu#usage-tiers)
- Render Free sleeps after inactivity and has shared usage limits. Keep the app on the Free plan without a payment method; quota exhaustion must suspend/defer work, never buy overages. Its filesystem is disposable. [Render Free](https://render.com/docs/free)
- Supabase Free currently includes a 500 MB database and 1 GB object storage, and idle projects can pause. Automatic paid backup/PITR features are not included in the plan. [Supabase pricing](https://supabase.com/pricing)
- Verify Supabase connectivity using the selected network and pooler; free direct IPv4 is not assumed. Use trusted precreated demo logins because default auth email restricts recipients and currently permits only two messages/hour. No paid networking/email add-on. [Connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Auth email](https://supabase.com/docs/guides/auth/auth-smtp)
- Use a free platform subdomain and static Pages deployment; avoid deploying model binaries as static assets. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

No anti-sleep pings, multi-account quota evasion, paid fallbacks, borrowed public demo endpoints, or expiring trial credits as the foundation. If eligibility, compatibility or available quota fails, record a blocker. The owned-laptop worker is the explicitly selected preferred judging route after feasibility, not a silent substitute for HF verification. Keep its measurements and availability separate; required HF deployment criteria remain unfinished if blocked.

## 2. Models to run ourselves

These are initial candidates, not measured winners. T01 runs feasibility spikes; T09-T12 and T20 establish actual quality. Pin model and tokenizer commits, licenses, dependencies and checksums.

| Function | Candidate | Implementation |
|---|---|---|
| English fact extraction, evidence-based explanations and difficult scan reading | `Qwen/Qwen3-VL-2B-Instruct` | One small vision-language checkpoint in runtime A; bounded text and one-page image calls; strict validation and evidence checks |
| Regional speech transcription | `ai4bharat/indic-conformer-600m-multilingual` | ONNX Runtime CPU in runtime B initially; preserve original transcript; require/confirm speech language when automatic detection is uncertain |
| Indic to English translation | `ai4bharat/indictrans2-indic-en-dist-200M` | Segment/answer-level translation in runtime B |
| English to Indic questions/feedback | `ai4bharat/indictrans2-en-indic-dist-200M` | Translate clarification text; preserve names/numerals |
| Similarity and classifier features | `sentence-transformers/all-MiniLM-L6-v2` | Frozen English embeddings on CPU; respect tokenizer limits |
| Our own trained model | `udyam-answer-relevance-v1` | Small classifier over question-answer features; described below |
| Final numerical aggregation and economic checks | Versioned Python rules | Deterministic rubric arithmetic; no model trained to predict funding eligibility |

The Qwen model is Apache-2.0; it is an open-weight base model we deploy, not a model we trained. Its performance on the actual Hindi handwriting must be measured. A reviewable unreadable result is preferable to invented text. [Qwen model card](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct)

IndicConformer lists the needed Hindi/Bengali/Odia/Telugu coverage and is MIT-licensed; its hosted files require accepting access conditions. Validate CPU resource use and inspect/pin any remote repository code before execution. Segment-level references are sufficient if reliable word timestamps are unavailable. [IndicConformer model card](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual)

The distilled IndicTrans2 models are small, MIT-licensed candidates; repository access may require accepting conditions. Their cards mention newer models, but the initial choice here prioritizes footprint. Do not substitute a larger model without resource and quality measurements. [Indic-English card](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M), [English-Indic card](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M)

Printed PDFs should use normal text extraction first. Printed OCR may use Tesseract as a cheap fallback; handwritten/overwritten pages require visual extraction or review. Do not claim printed OCR proves handwriting support. Several regional text PDFs have suspicious glyph mappings despite no replacement characters, so text-layer presence is insufficient. Mixed-language text is segmented and language-identified before translation. T01/T09/T11 must choose and measure explicit text/audio identification; script detection alone cannot distinguish Hindi/Marathi. Audio language selected by an applicant is labeled declared until validated; never label it automatically detected merely because it was selected. Preserve facts beyond the standard form when the questionnaire changes.

## 3. The model we will build

**Model:** `udyam-answer-relevance-v1`.  
**Question:** does this answer address the associated business question?  
**Output:** relevant / irrelevant / uncertain, with evidence and classifier provenance. Empty answers are missing by deterministic rules; contradictions and unreadable handwriting are separate checks.

Training pipeline in T09A:

1. Extract question-answer pairs from the corpus, remove identity and retain source/family IDs. A file can yield many examples, but these are correlated and must not be counted as independent entrepreneurs.
2. Label readable pairs using a written rubric. Record whether labels came from a qualified human, Codex or synthetic generation; only independently reviewed real examples qualify for the final quality claim.
3. Build a rule/cosine-similarity baseline, then train a small scikit-learn logistic regression classifier using frozen question/answer embeddings, absolute differences and cosine similarity. Keep preprocessing and embedding revision fixed.
4. Group-split by base business/scenario family; keep translations/variants together. Tune thresholds on validation groups, never the held-out test. Include irrelevant answers that contain business vocabulary and valid short answers as hard cases.
5. Report macro-F1, irrelevant-class precision/recall, class/group counts, confusion matrix and abstention coverage. Initial promotion gates: macro-F1 at least 0.80, irrelevant precision at least 0.90, no deterioration from the baseline on held-out real groups. These targets are not guarantees.
6. Export a small versioned artifact plus preprocessing contract, seed, manifest hash, metrics, license and model card. Use a pinned supported serialization/export format; never load untrusted pickle files.
7. Deploy as advisory validation only if evidence supports promotion. If label/class/group coverage is insufficient or gates fail, retain the transparent baseline in the release, keep the trained candidate experimental and report why. T09A can complete with a documented rejected candidate; it cannot claim a validated custom model in that case.

The 55 files do not contain business-success outcomes or a large independent training population. Do not train a business-success/funding predictor, claim a foundation model was trained, or fine-tune a large language model during the 30-hour window. The honest innovation is a custom relevance validator combined with self-hosted pretrained language/speech/vision models and explainable rules.

## 4. Durable execution without a paid worker

For the preferred owned-worker profile: the API atomically creates durable revision/stage state; an operator-started laptop worker uses restricted outbound HTTPS operations to claim with a fencing generation, fetch fresh signed source URLs, execute a bounded stage and checkpoint/publish. No public port/tunnel or full database key is required on the laptop. Use native startup/resume commands as well as an optional container wrapper. Record `waiting_for_worker` if offline; queued inputs remain in Postgres. Bounded polling/backoff serves actual work during processing/judging sessions, not dummy keep-alive traffic. Check device/framework compatibility, gated downloads and crash recovery in T01/T07. The following numbered flow specifies the separately verified HF adapter.

1. API authenticates the user and atomically stores the input revision, stage records and enqueue intent in Postgres. Return an accepted job ID.
2. A bounded dispatcher submits an event to a user-owned Gradio Space and records the event ID. Event enqueue latency is measured; no inference waits inside the submission request.
3. The Space validates a signed, expiring, job/stage-specific service capability **before** any expensive inference. Internal GPU functions are not exposed as unauthenticated alternate endpoints. Fetch sources through authorized short-lived URLs.
4. Claim a lease through restricted HTTPS API operations; do not share the full database service key or arbitrary SQL capability with model code. Run one bounded page/audio chunk/translation batch at a time.
5. Persist each stage output with input/model/schema hash and atomic idempotency key. Store originals privately and return evidence references. An event queue is not durable storage.
6. Completion may enqueue the next stage through the API. Reconcile pending/stale jobs on API startup, authenticated status/submit activity and explicit resume. Background execution exists only while the free runtimes are awake; do not promise an always-on scheduler.
7. If a Space sleeps, quota is exhausted or a job exceeds a stage limit, preserve progress and show `waiting_for_runtime`, `quota_exhausted` or `needs_review`. Resume when capacity returns without redoing completed model calls unnecessarily.

Both profiles must validate lease generation/expiry atomically on heartbeat, checkpoint and publication, excluding stale workers. Renew expiring stage capabilities safely when queue delays exceed their lifetime. Perform authentication in a wrapper before calling expensive GPU-decorated work; internal inference functions must have no alternate public endpoint. Signed file URLs are issued after claim, not pre-generated for an unbounded queue wait.

The Gradio client enqueue/auth/event contract and account-attributed GPU quota behavior must be proven in a real T01 spike. Do not assume a server token gives each anonymous app user a separate GPU quota. If this integration fails, T24 is blocked until a compliant free route is working.

No heavy model is imported into the small Render API process. Model files/caches and temporary source files are disposable; model revision manifests and job outputs are durable. API and Space endpoints use HTTPS, including internal calls, avoiding assumptions about direct database ports from Spaces.

## 5. Model deployment and scaling requirements

T23A must produce:

- `models/manifest.json`: repo/artifact ID, exact revision/checksum, task, tokenizer/preprocessor, license, framework and expected device; no private training data.
- Two Gradio Space entry points under `deploy/spaces/` plus portable local/container worker entry points sharing the same pipeline interfaces.
- A real versioned owned-laptop serving configuration, native start/stop/resume instructions, restricted credentials and measured offline/restart recovery; do not label a portable entry point alone as deployment.
- Model readiness distinct from API liveness: downloading, loading, ready, quota exhausted and unhealthy.
- Benchmark record: cold download/start, warm latency, peak RAM/VRAM, tokens/pages/audio seconds, queue wait and stage execution time.
- Bounded concurrency initially one model stage per runtime, finite stage timeout, memory limits and input caps. An 11-page document becomes bounded resumable page work.
- A promoted classifier artifact or an explicitly labeled experimental candidate and baseline serving configuration; inference must not launch training.
- Rollback by manifest/model version; invalidate cached outputs and embeddings when their relevant model/preprocessing changes.

Use the ZeroGPU-supported startup/model placement pattern and pinned compatible package versions. Do not assume lazy CUDA loading, vLLM daemons or ONNX GPU execution work under ZeroGPU. Benchmark separate process/model lifetimes for a local worker instead. If a model exceeds the free runtime's memory/time budget, reduce bounded inputs or choose a measured smaller compatible model; never automatically switch to a paid endpoint.

T22 measures API/storage/job scaling locally using multiple containers and a local test database. Load tests must not hammer free Supabase, ZeroGPU, Nominatim or Overpass. Run only small smoke checks on public free infrastructure. Add model-capacity measurements separately; a 50-user metadata test does not establish 50 simultaneous generations.

At growth time the same contracts support additional owned/institutional workers, CPU/GPU specialization, batching and model replicas. Under the current zero-spend deployment, enforce queue admission and show wait estimates instead of pretending automatic free GPU scaling exists.

## 6. Free location context

Resolve applicant-confirmed locality/PIN to an approximate area; use public Nominatim only for explicit, moderate user-triggered lookups, with an identifying User-Agent, a shared maximum of one request/second, caching and no autocomplete or bulk corpus geocoding. Never send beneficiary names/contact details. [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)

The public policy also requires a deliberate informed developer decision for generated applications and prohibits offering a generic generated geocoding service. Keep public Nominatim disabled until Kartik explicitly opts in after reading the policy. Use confirmed coarse coordinates/area and the licensed dated snapshot meanwhile. User-triggered traffic alone does not supply this developer opt-in.

Retrieve bounded shop/service categories from Overpass for that area, cache allowed results with retrieval time and display OpenStreetMap attribution. Use a small licensed regional OSM snapshot for a repeatable offline/demo fallback, labeled with date/source. Neither source is a complete directory of rural/informal competitors. Public Overpass infrastructure has capacity/fair-use constraints; use configurable endpoints and do not load test it. [Overpass resource guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)

## 7. Zero-spend release gate

- No Gemini/Sarvam/Google Places or other paid inference/location credentials or fallbacks.
- No Render background worker/Key Value subscription, paid Space plan, GPU purchase, trial-credit dependency or paid domain.
- Verify selected dashboard plans and quotas. `ALLOW_PAID_SERVICES=false` records intent; also review real infrastructure configuration and dependencies, because a flag alone cannot prevent a bill.
- Enforce app quotas below remaining free resources and stop/defer when exhausted. Keep Render without a payment method; do not enable supplementary billing.
- Run the demo on the explicitly selected owned-worker backend with actual inference; record local versus HF execution separately. Verify required owned Space deployments under T23A without claiming their quota provides continuous inference. Precomputed results/fixtures remain visibly separate. If HF gates remain blocked, report a verified selected-profile demo separately from incomplete full-backlog release.
- Report what is free, what can sleep, current available capacity and what is unverified. Do not describe free-tier deployment as an SLA-backed production service.
