# Why PDF processing looked stuck, and what changed

18 October2026. Diagnosis used existing application logs, checkpoint counters,
saved timings and focused software tests. The model-accuracy benchmark was not
rerun. Originals and previous results were preserved.

## The actual causes

1. **A database lock-order bug interrupted inference.** Claim/replay locked the
   worker-runtime row before the stage. Heartbeat locked the stage before the
   runtime row. Concurrent requests could deadlock; actual logs show PostgreSQL
   deadlock errors returningHTTP500. Heartbeat now uses the same lock order.
2. **Recovery could wait on its own old lease.** After a transport failure the
   model process stopped, but retries used a new execution identifier against
   the already-started lease. That correctly returned409 for duplicate safety,
   but recovery could wait for the600-second lease. Temporary500responses now
   receive bounded retries with the same request. After an accepted execution
   fails, its child stops before its current fenced lease is released for
   checkpoint-based recovery. Duplicate/unaccepted executions cannot release
   somebody else's live work. A fully unavailable API still requires lease
   expiry; this is the safe fallback, not unlimited automatic retry.
3. **The visible page stopped polling after five minutes.** Longer work could
   complete on the server while the page still showed2/4. Active visible-page
   polling now continues for30minutes, pauses in a hidden tab and exposes stage
   detail: pages, translated segments, extraction batches or rating dimensions.
   The stage counter is not a linear percentage of processing time.
4. **PDF line layout added avoidable network work.** Digital extraction preserves
   lines as source segments. The structurer intentionally accepts at most four
   segments per model request; the observed PDF needed seven model calls. We
   retained those grouping/prompt rules to avoid changing evidence interpretation.
   English passthrough formerly wrote a remote checkpoint for every line even
   though it runs no translation model. It now batches eight cheap passthrough
   segments per write, preserving each actual non-English translation checkpoint.
   A20-segment software check proves identical final evidence with3writes instead
   of20. Missing rating dimensions are also checkpointed with the next computed
   judgment/final output; every actual model judgment is still checkpointed.
5. **The normal worker environment was older than the evaluated recipe.** It
   had Transformers4.57.6/hub0.36.0, while the saved component evaluation used
   Transformers5.0.0/hub1.33.0. The owned environment now matches those pinned
   packages and includes the PDF renderer. Dependency/config checks pass. CUDA
   Torch2.9.1+cu128 and all model weights were retained. No quantization, token
   truncation, lower OCR resolution, reduced model or changed prompt was added.

## How much time should it take?

| Evidence | Recorded time | Interpretation |
| --- | --- | --- |
| Prior controlled14-case business evaluation on this RTX3050 | Median60.698s; p95 110.163s | Short authored text examples on its recorded evaluated runtime; not a guarantee for every document |
| Three recent saved application PDF records before this repair | 262s,279s,803s; mean448s (7m28s) | Wall time includes queue/network/recovery. The13m23s outlier needed a retry and showed the observed failure pattern. These records are not a controlled GPU benchmark. |
| Latest affected PDF | Completed4/4, no job error | It had completed server-side; stale five-minute page tracking could conceal completion |
| Earlier digital-PDF demonstration | About70s for one case | Historical run on its recorded environment, not a new current-machine average |
| Earlier11-page Hindi scan | About415s for extraction/recovery | Historical scan evidence, not total end-to-end time or measured handwriting accuracy |
| Optimized post-fix mean | **Not yet measured** | Do not advertise a new average or accuracy number from software-only checks |

For presentation scheduling, allow a few minutes for a short text/digital PDF and
substantially more for scans, long audio, translation or a queue. Start one compact
case ahead of the presentation, then open its saved result. Large scanned forms
are not a real-time workload on this laptop. Audio wall time depends on duration,
language, translation and queue history; an old job's save-to-update time is not
a speech model's real-time factor.

The observed PDF had about125seconds of structuring generation alone, excluding
its30-second model load and database waits. It also needed a separate rating
stage. A thirteen-minute result should therefore trigger a recovery/queue check;
it should not be described as thirteen minutes of useful OCR or model reasoning.

## What to use now

Refresh **http://127.0.0.1:5173** to load the updated UI. Previously accepted
ideas and results remain saved. Open the completed idea first; do not submit it
again merely to see the result. Use **Refresh status** if an older browser tab
has stopped following progress. Resume only an actually paused/failed job, after
checking its reason; source-quality failures are not fixed by repeatedly retrying.

[input/quick-demo](../input/quick-demo/README.md) has four short fictional
text/digital-PDF examples and authored positive/loss/funding checks. The complete
paragraph survives PDF extraction; original inputs, difficult cases and the
organizer's source corpus remain intact. Mark these examples synthetic. Shorter
demo files reduce batches without cutting real applicant documents.

Verification:45 focused worker/transport/text/PDF checks pass, including a real
Postgres contention regression, renewed-lease recovery and unchanged passthrough
evidence. Six grouped browser journeys cover language/drafts/upload recovery and
the2/4 view continuing beyond five minutes. Browser Auth/API/model responses are
fixtures replaying saved results; these checks do not establish new model accuracy
or a measured post-fix speedup. API/workspace/frontend health is verified separately.
