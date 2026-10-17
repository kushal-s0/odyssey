# Free application and model deployment checklist

**Executor: Codex. Status: planned, not deployed.** Apply this during T23, T23A, T24 and T25. Every completed check needs actual evidence in its task report. See [FREE_MODEL_HOSTING_PLAN.md](FREE_MODEL_HOSTING_PLAN.md) for official sources, model choices, runtime contracts and account requirements.

**Deadline:** 18 October 2026, 06:00 Asia/Calcutta, deployed demo included. Prepare skeleton configuration in T02 and seek approval for an early preview; this checklist still governs final release. [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md) distinguishes a selected-profile demo from full-backlog completion. Full implementation is authorized; no deployment/source upload is approved. Final T27 must provide a detailed deployment walkthrough.

## 1. Verify the selected zero-spend profile

| Component | Target | Durable state |
|---|---|---|
| React frontend | Cloudflare Pages Free, supplied HTTPS domain | None |
| Lightweight API | Render Free web service | Postgres and private storage; no model weights |
| Jobs | Postgres stages, dispatch intent, leases and idempotency keys | Supabase Free |
| Preferred judging model backend | Owned RTX 5050 laptop worker, if measured feasibility passes | Restricted outbound HTTPS claim/checkpoint APIs; durable outputs in Postgres/private storage |
| Secondary model runtime A | Owned Gradio ZeroGPU Space for text/document models, embeddings and classifier | Separately verified deployment; restricted HTTPS checkpoint API |
| Secondary model runtime B | Owned Gradio ZeroGPU Space for regional speech/translation | Separately verified deployment; restricted HTTPS checkpoint API |
| Identity/data/files | Supabase Free Auth, Postgres/pgvector and private Storage | Versions, originals, evidence, audit history |
| Local business context | Bounded/cached OSM queries or an attributed dated regional snapshot | Source/time/area and allowed cached data |

No paid inference keys, background-worker subscription, hosted Redis/Key Value, purchased GPU, paid Space subscription, paid domain or trial-credit dependency. The user confirmed an eligible HF account, but actual free provisioning must be checked. Sleeping services and limited GPU quota remain operational constraints.

Owned inference avoids a provider daily allowance but requires laptop uptime, power/network and measured model fit. Do not describe the primary profile as fully cloud hosted or unlimited. Keep required HF deployment criteria visible if blocked; a local-backed demo does not complete them. Every artifact publication, including direct frontend uploads or Space source, needs explicit approval independent of local commits.

For local tests, use a separate local Postgres/object-store/auth setup or documented development Supabase profile. Load tests must use local/owned infrastructure rather than public free services.

## 2. Environment and model contracts

Create `.env.example` with names/descriptions only. Keep all private values in deployment secrets.

| Configuration | Purpose |
|---|---|
| `APP_ENV`, `PUBLIC_WEB_URL`, `CORS_ORIGINS` | Environment and exact browser origins |
| `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public frontend identifiers only |
| `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | API-only database/service identity; avoid giving full database access to model runtimes |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` | Verified login tokens |
| `PRIVATE_UPLOAD_BUCKET` | Private originals and derived artifacts |
| `JOB_BACKEND=postgres`, `MODEL_RUNTIME=owned_worker` | Preferred durable queue and judging inference profile; `hf_zerogpu` is a separately verified adapter |
| `WORKER_ID`, `WORKER_API_URL`, `WORKER_CREDENTIAL` | Scoped owned-worker identity/HTTPS service access; no full database/service key |
| `TEXT_DOCUMENT_SPACE`, `SPEECH_TRANSLATION_SPACE` | Owned Space identifiers, not other people's public demos |
| `HF_TOKEN` | Minimum-scope token for permitted model downloads/API calls; never browser-side |
| `STAGE_CAPABILITY_SIGNING_KEY`, `INTERNAL_API_URL` | Restricted, expiring stage execution and checkpoint authorization |
| `MODEL_MANIFEST_PATH`, `RELEVANCE_MODEL_VERSION` | Versioned weights/preprocessing and promoted-classifier or baseline selection |
| `MAX_MODEL_CONCURRENCY`, `MAX_STAGE_SECONDS`, `MAX_QUEUE_DEPTH` | Measured runtime/admission limits |
| `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `MAX_AUDIO_SECONDS`, `MAX_IMAGE_PIXELS` | Bounded inputs, including support for supplied 11-page scans |
| `MAX_JOB_ATTEMPTS`, `LEASE_SECONDS`, `MAX_ACTIVE_JOBS_PER_USER` | Bounded retry/claim behavior |
| `NOMINATIM_URL`, `OVERPASS_URL`, `OSM_USER_AGENT` | Configurable free-data endpoints with application-wide throttling |
| `ALLOW_PAID_SERVICES=false`, `DEMO_MODE`, `ENABLE_CLARIFICATIONS` | Cost policy and explicit feature modes |
| `ENABLE_PUBLIC_NOMINATIM=false` | Public geocoder stays disabled until Kartik deliberately opts in under its policy |

Do not include legacy Gemini/Sarvam/Google Places keys or an automatic fallback to paid services. The zero-spend flag is a configuration safeguard, not proof: inspect actual service plans, manifests, dependencies and egress destinations.

## 3. Release sequence

1. [ ] Verify eligible free Space creation, model access/licenses, account quota and compatible Gradio/PyTorch/ONNX versions. Prove the signed API-to-Space event path before building assumptions around it.
   - [ ] Separately prove the preferred laptop backend: compatible CUDA/framework, bounded actual text/scan/audio/translation inference, peak VRAM/RAM and authenticated claim/checkpoint recovery. Hardware inventory is not this check.
   - [ ] Record remaining HF GPU quota and reset time; free accounts currently have a five-minute daily allowance resetting 24 hours after first usage. Keep corpus evaluation on owned hardware and reserve bounded quota for required HF smoke checks.
2. [ ] Select Free plans and supplied subdomains. Keep Render without a payment method; never enable automatic paid overages. Record free resource limits and application cutoffs.
3. [ ] Apply versioned database migrations; configure private storage and roles. Create limited demo accounts through trusted setup; do not rely on paid SMS or bulk email delivery.
   - [ ] Verify actual Supabase JWT settings and network/pooler connection mode without a paid IPv4 add-on. Test precreated password logins; default SMTP is not a public signup-delivery dependency.
4. [ ] Build the API image without model weights/frameworks; validate memory against the selected free instance. Build the static frontend.
5. [ ] Deploy the two Gradio model runtimes from pinned code/model manifests. Check supported startup placement and use GPU decorators only for compatible PyTorch paths. Keep ONNX speech on CPU unless a supported alternative is proven.
   - [ ] Package/start the preferred owned worker with native stop/resume commands and a versioned model manifest. Record selected backend, power/network dependency and offline state; no public laptop port is needed.
6. [ ] Obtain explicit publication approval for exact sanitized contents/destinations, then deploy API/frontend; verify CORS/auth redirects, private uploads, selected model readiness and restricted checkpoint calls. Never push GitHub as an implicit prerequisite.
7. [ ] Exercise actual inference for text, digital PDF, handwritten scan and audio, then a policy-compliant OSM lookup. Do not use precomputed fixtures as live evidence.
8. [ ] Verify all comparison views, clarification, arithmetic, reviewer corrections, report printing and version history.
9. [ ] Simulate restart/sleep/quota exhaustion and recover from durable stage records. No always-on dispatcher is assumed; app activity/manual resume can restart pending work.
10. [ ] Record release URL, commit and model manifests, actual timings/resource usage and unresolved limits. Run rollback and confirm compatible historical outputs remain available.
11. [ ] Update task reports, tracker/CSV and handover documents only with observed results.

## 4. Acceptance checks

### Data, access and core behavior

- [ ] Text/PDF/MP4/OGG and browser recordings work with intact, privately stored originals.
- [ ] The 11-page scans use bounded resumable page processing; ambiguous handwriting and conflicting answers remain reviewable.
- [ ] Every displayed fact/rating cites source evidence or states insufficient evidence; nulls never become invented values.
- [ ] Domain/trade/cohort/across-cohort comparisons respect rubric eligibility, group counts and cohort permissions.
- [ ] User A cannot query User B's input/job/file/report; reviewers cannot see unassigned cohorts through search, similarity or aggregates.
- [ ] Model endpoints verify signed stage access before spending GPU resources. Do not expose an alternate unauthenticated expensive endpoint.
- [ ] The owned worker cannot access unrelated stages/files; checkpoint/publication rejects expired or replaced lease generations. Queued work fetches renewed source URLs after claim and safely renews expired capabilities.
- [ ] Source data and capability tokens are absent from public Space repositories, Gradio examples/logs and frontend assets.
- [ ] Malformed files, malicious source instructions and model JSON errors produce bounded actionable results.
- [ ] Regional feedback, clarification revisions and revenue-versus-profit checks are verified.
- [ ] Language identification is distinct from declared language; English/Hindi reviewed quality is separated from unvalidated Marathi/Telugu/Bengali/Odia. PDF glyph/script corruption is checked beyond empty/replacement-character tests.
- [ ] Public Nominatim is disabled unless Kartik explicitly opted in after reviewing the current policy. Any approved use is app-wide rate-limited/cached/attributed, never generic geocoding or bulk/autocomplete; snapshot results carry source/date/area labels.

### Models and training

- [ ] Manifest pins model/tokenizer/preprocessor revisions, licenses and artifact hashes.
- [ ] The classifier report identifies real/synthetic/Codex/human labels and grouped train/validation/test separation.
- [ ] Promotion decision is explicit. Failed/insufficient validation leaves a labeled experimental candidate and the baseline active.
- [ ] Inference loads a released artifact; it never trains on each user request or downloads a moving latest checkpoint.
- [ ] Capture cold model loading, warm stage time, peak RAM/VRAM, queue wait and actual runtime quota behavior.
- [ ] Model readiness is separate from API liveness. Loading, unavailable weights, quota exhaustion and incompatible artifacts are visible.
- [ ] A model rollback and a crashed stage preserve evidence/history; cached outputs use the correct model/input versions.

### Reliability and capacity

- [ ] Duplicate event/lease races publish one assessment version. Repeated inference after a crash may consume quota; this is measured and bounded.
- [ ] Accepted jobs survive service sleep/restart and resume after capacity returns; pending jobs are never silently discarded.
- [ ] An offline laptop shows waiting_for_worker; an operator resume restores processing without duplicated publication. Local and HF readiness/quota/failure measurements are separate.
- [ ] T22's multi-instance metadata/job tests run locally and report actual hardware/latency/results.
- [ ] Model throughput is measured separately from metadata throughput; no claim of unlimited free autoscaling.
- [ ] Shared queue admission, Nominatim throttling and resource limits hold across API replicas.
- [ ] Free storage/egress/queue limits stop or defer work safely. No request switches to a paid API.
- [ ] Manual database/object export and restore instructions are tested; no reliance on paid automatic backup/PITR.

## 5. Zero-spend and quota record

Record actual account plan names, available allowances and observed use in `docs/DEPLOYMENT_RECORD.md`. Service subscription/API spend must be zero. Existing laptop electricity/network use is separate if a local worker is used.

| Resource | Measure and record |
|---|---|
| API | Free instance hours, memory, cold start, bandwidth/build limits |
| Persistence | Database bytes, object bytes, egress and connections |
| Models | GPU quota attribution/time, CPU processing time, model cache size, peak memory |
| Open map data | Cache hits, global request rate, response/source timestamps |
| Custom model | Dataset provenance, training time/hardware, artifact bytes, held-out results |

Do not translate compute availability into a fixed promised requests/day figure without benchmarking actual workload and account quota. Do not keep services awake artificially or bypass platform restrictions.

## 6. Handover

- [ ] Public HTTPS app URL and owned model runtime IDs; limited demo login instructions.
- [ ] Source/lockfiles, migrations, Pages/Render Free manifests, two Space packages and portable local worker entry points.
- [ ] Model manifest, classifier model card, baseline/promotion decision and reproducible training/evaluation commands.
- [ ] Dataset inventory and sanitized evaluation artifacts; original beneficiary material excluded from public artifacts.
- [ ] Actual free-deployment and model benchmark results with limits and cold-start expectations.
- [ ] One Markdown report per completed task, including T09A and T23A, plus consistent tracker/CSV.
- [ ] SESSION_HANDOFF.md records exact next command, checks, blockers, active processes, confirmed decisions and pending approvals so another model/session/account can continue from actual state.
- [ ] Every new commit has Kartik as both author/committer and no co-author/sign-off/AI trailers; source/publication remains within explicit authorization.
- [ ] Final implementation summary, readiness report, operations guide and five-minute demo script.

Completion establishes a verified quota-limited free hackathon deployment. Larger production capacity depends on additional available hardware and validated operational capacity; it is not promised by the free tier.
