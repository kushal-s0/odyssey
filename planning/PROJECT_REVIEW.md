# Project and plan review - 17 October 2026

## Finding

The product plan matches the organizer's main requirements. Its strongest features are preserved originals, evidence-linked explanations, explicit missing/conflicting information, human review and deterministic arithmetic. The largest delivery risks are late deployment, unverified model/runtime integration, GPU quota, language validation and a large sequential backlog before the first usable demo. This review does not establish that the application works.

The confirmed deadline is **18 October 2026 at 06:00 Asia/Calcutta**, including a deployed demo. The historical 30-hour event window is not time remaining. Follow [HACKATHON_DELIVERY_PLAN.md](HACKATHON_DELIVERY_PLAN.md) for checkpoints and [SESSION_HANDOFF.md](SESSION_HANDOFF.md) for current authorization and state.

## Inspected material and actual state

- Read all ten original planning files and the repository execution guide, the complete three-page organizer brief, archive inventories, extracted PDF text and representative difficult examples. Visually inspected the brief, contact sheets of all four 11-page scans and a full-size handwritten page. This was not a transcription of every handwritten field.
- Independently enumerated all 55 archived submissions: 42 PDFs, 109 PDF pages and 13 recordings; approximately 49.88 MiB uncompressed in total. Archive paths match the existing 55-entry inventory. Four Hindi scans account for 44 pages and have no text layer. No byte-identical submission files were found; semantic scenario families still repeat.
- Inspected audio containers: 11 audio-only MP4/AAC files and two OGG files. MP4 track metadata gives approximately 99-353 seconds; OGG metadata gives approximately 159 and 323 seconds. Every recording is below the proposed ten-minute limit. An initial general-purpose MP4 metadata read incorrectly reported zero duration; track-level inspection corrected this. Use FFprobe or a real decoder in T01, not zero values from that parser.
- Recordings were not listened to, transcribed or validated for language/content. No language-quality or ASR accuracy claim follows from folder names or metadata.
- Existing inventory character counts differ with the current text extractor on the 38 text PDFs. Pin extraction tool/version and hashing in T01; do not treat character counts as content integrity checks.
- Repository at review start: `origin=https://github.com/kushal-s0/odyssey.git`, branch `master`, clean working tree, HEAD `d2fb9a7`. No application scaffold, task implementation report, trained artifact or deployment exists. Pre-existing `.tools/` dependencies do not constitute a completed T01.
- Git contains 255 tracked `.tools/` files, including two approximately 32 MB platform-specific AV wheels, as well as original dataset archives. There is no root `.gitignore`. T02 must exclude these from future build/publication artifacts; adding ignore rules alone will not untrack existing files. Preserve originals and historical commits. No history rewrite is authorized.
- Hardware readout: NVIDIA GeForce RTX 5050 Laptop GPU, 8151 MiB reported VRAM, driver 592.82; HP Victus laptop, 24,841,998,336 bytes reported system memory. No CUDA/PyTorch/model execution or sustained thermal test was performed. Docker CLI exists, but the engine was unavailable; container tests remain unverified.

## Changes recommended and incorporated into planning

| Priority | Problem | Required planning change |
|---|---|---|
| Critical | Hosted model deployment and full application deployment appear at the end | Prove inference and checkpoint interfaces in T01; prepare deployment configuration in T02; seek publication approval for an early preview; retain final release checks in T23-T25 |
| Critical | Free GPU allowance is unsuitable as an unmeasured evaluation budget | Prefer owned-laptop inference for judging after a measured smoke test; reserve HF for bounded integration/deployment checks and explicit quota accounting |
| Critical | Session/account limits could interrupt undocumented work | Keep a concise handoff, exact next action, user decisions, reports, verification commands and local commit checkpoints; never rely on this conversation |
| High | A blocked all-or-nothing T01 could stall safe local work | Record capability-specific evidence and blockers; allow only explicitly independent task portions, without claiming the blocked task/dependent integration is complete |
| High | All 28 tasks could finish late or remain incomplete | Separate a verified demo checkpoint from full-backlog completion, preserve all tasks and acceptance gates, and reserve the final two hours for deployment recovery and rehearsal |
| High | Language detection has no chosen implementation and ASR takes a language code | Add an explicit text/audio language-identification strategy and measured low-confidence confirmation path; declared language is not automatic detection |
| High | Text corruption is broader than a null/replacement-character check | Include suspicious script mixing, broken glyph mapping, layout errors and visual cross-checks; several Marathi/Telugu text PDFs contain corrupted mappings without replacement characters |
| High | Changed-question examples need facts beyond the common form | Preserve additional business facts with source evidence; do not force technical capacity, licensing claims or maintenance costs into unrelated numbered questions |
| High | Renewed leases alone cannot exclude late stale workers | Require a monotonically increasing lease generation/fencing value on heartbeat, checkpoint and publication; reject a worker after its claim expires or is replaced |
| High | Signed URLs and service capabilities can expire while queued | Obtain source URLs after successful claim; bound capability lifetime/renewal and authenticate outside expensive GPU execution; never expose an alternate unguarded inference endpoint |
| High | Tiny grouped training data may not support valid evaluation | Audit family/class coverage before training; fit preprocessing only on training groups; retain a transparent baseline and an explicit rejected/experimental candidate when evidence is insufficient |
| High | Free auth email and database networking can block a live demo | Provision limited password demo accounts through trusted setup; verify project JWT settings and IPv4/session-pooler connectivity; do not depend on public signup emails or buy an IPv4 add-on |
| Medium | A laptop GPU with 8 GB VRAM does not establish model fit | Pin a compatible CUDA/PyTorch build, bound image/context/output sizes, run one GPU stage initially, measure peak VRAM/RAM and recovery before promising performance |
| Medium | The first live audio in a five-minute demo may run too long | Use a genuinely short live input; keep clearly labeled previously processed real examples with source/model/version provenance for slow paths |
| Medium | Free directory coverage can be sparse | Prefer confirmed coarse location and a sourced dated regional snapshot; public Nominatim is opt-in only under its current policy, never automatic bulk geocoding |

Keep the deterministic scoring rules, six potential dimensions plus separate completeness, private storage, access boundaries, immutable revisions, family-separated evaluation, all four comparison views and explicit partial results. Do not replace them with invented confidence or success metrics. Classifier relevance is distinct from the plausibility of a claimed number: an implausible but on-topic answer can be relevant and separately need validation.

## Current official constraints checked

- [HF Spaces overview](https://huggingface.co/docs/hub/en/spaces-overview): eligible free personal accounts can host two Gradio ZeroGPU Spaces; generic new compute/Docker Space creation must not be assumed free.
- [HF ZeroGPU](https://huggingface.co/docs/hub/en/spaces-zerogpu): the current table lists five GPU minutes for a free account, resetting 24 hours after first GPU usage; compatible Gradio/PyTorch GPU functions are required. Two Spaces are not evidence of two independent quota budgets. Actual server-token attribution must be measured. Do not consume all quota on tuning before the demo.
- [Render Free](https://render.com/docs/free): idle spin-down after 15 minutes, roughly one-minute wakeup, ephemeral disk, limited instance hours and possible suspension for unusually high outbound traffic. No payment method or automatic paid fallback. Keep parsing/model work out of the lightweight API where feasible.
- [Supabase Free](https://supabase.com/pricing): 500 MB database, 1 GB storage and 5 GB egress are the currently listed allowances; free projects can pause after a week of inactivity. Small original corpus size does not bound derived page/audio storage or repeated egress.
- [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres): use a verified connection mode, including the shared session pooler for IPv4-only networks; do not assume a free direct IPv4 endpoint. [Default auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp) restricts recipients and currently allows only two emails/hour; use prepared demo accounts.
- [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/): deliberate developer opt-in, no generic autogenerated geocoder, maximum one request/second across the app, identifying User-Agent, caching, attribution, no autocomplete/bulk lookups and no confidential data. Keep it disabled until Kartik makes that informed selection; a licensed snapshot/confirmed coordinates can support the initial demo.
- [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/): static frontend target remains appropriate. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) can avoid a GitHub push after explicit deployment approval; it still publishes an artifact and needs that approval.
- [Qwen candidate](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct), [IndicConformer](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual), [Indic-English translation](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M), [English-Indic translation](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M): candidates remain unbenchmarked on this laptop. AI4Bharat downloads require access-condition acceptance. Authors mention newer replacements; this does not establish better fit for the available hardware/deadline. Do not switch without a bounded comparison.

## Limits of this review

No account dashboards, free Space provisioning, gated downloads, training, live inference, public deployment, security implementation or load tests were verified. English and Hindi human review are available from Kartik; Marathi, Telugu, Bengali and Odia remain unvalidated. The full 28-task plan is a substantial build from an empty application repository; completion by the deadline cannot be guaranteed. A narrower verified demo is not evidence that every backlog gate passed.

## Documentation verification

Inline Python checks verified 28 unique tasks, a valid dependency order, matching task index/CSV titles/dependencies/report paths, all-pending tracker/CSV status and 53 existing relative Markdown links. The CSV now includes explicit execution-order numbers. `git diff --check` passed after repairing whitespace. Inspection regenerated tracked Python bytecode caches; those inspection-only changes were restored to their original Git bytes and excluded from the documentation commit. Original source archives and dataset inventory were preserved. These checks validate the revised planning artifacts, not application behavior.
