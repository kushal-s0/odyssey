# Deadline, deployment checkpoints and execution priorities

## Confirmed constraints

- Deadline: **18 October 2026, 06:00 Asia/Calcutta**, working deployed demo included.
- Service spend: zero; no paid APIs, subscriptions, GPU purchase, trial-credit dependency or paid fallback.
- Prefer inference without a provider's expiring allowance. Kartik can keep his RTX 5050 laptop running for inference/training. Use a verified owned worker as the preferred judging profile; free HF deployments remain a separate target, not the sole inference budget.
- Current authorization: review and revise planning/tasks/docs, then commit locally as Kartik. Application implementation and any publication need a subsequent explicit instruction. Do not interpret this file as authorization to start or deploy.
- Human review available: English and Hindi only. Mark other language quality unvalidated until reviewed.
- All 28 task IDs and their reports remain required for full-backlog completion. Never mark a failed/unmeasured criterion done to meet the clock.

## Deployment profiles

**Preferred judging profile, pending feasibility:** static frontend on Cloudflare Pages Free, lightweight FastAPI on Render Free, Supabase Free for auth/private files/Postgres jobs, and an owned-laptop worker for inference. The worker makes authenticated outbound HTTPS claim/checkpoint calls, downloads short-lived authorized inputs and persists results remotely. No public laptop port or tunnel is required for this pull-worker design. Scope credentials to worker operations; never give model code arbitrary database/service access. Network reachability and restart recovery must be demonstrated.

Local open weights avoid a provider's daily inference quota or trial expiration. Hardware capacity, uptime, disk, thermals, electricity and internet still constrain operation. The cloud services still have free-tier caps and sleep behavior. Present this honestly as a laptop-backed hosted demo, not an entirely cloud-hosted or unlimited service.

The operator starts the worker during real processing/judging sessions. Use bounded polling/backoff for actual work and stop idle sessions; no dummy keep-alive traffic. If the laptop is offline, accepted jobs remain durable and show `waiting_for_worker`. An explicit operator resume restarts pending work.

**Secondary hosted model profile:** two owned Gradio ZeroGPU Spaces with the existing signed stage contract. Verify actual eligibility/access/quota. Keep HF-specific CPU ONNX restrictions separate from laptop execution: a local supported PyTorch/GPU ASR path is allowed only after measuring it. Do not route automatically to HF or spend its remaining quota without recording the selected backend. No multi-account quota bypass.

T23A still packages the versioned local worker and both Space runtimes and verifies the required deployments. If free HF provisioning fails, record its unfinished criteria; the laptop demo can be verified separately, but full 28-task completion remains blocked until its required gates pass or Kartik explicitly revises that scope.

## Execution order and early preview

Keep one task active at a time and finish its report/status before switching. Use this explicit task order after implementation is authorized:

`T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T09 -> T09A -> T12 -> T08 -> T10 -> T11 -> T13 -> T14 -> T15 -> T16 -> T17 -> T18 -> T19 -> T20 -> T21 -> T22 -> T23 -> T23A -> T24 -> T25 -> T26`

This moves text understanding/scoring before the applicant UI milestone, so T08 can demonstrate a real text-to-assessment result. T09A remains a bounded required experiment and may reject a candidate; T12 must not depend on successful promotion. PDF/audio, assessor review and all required comparison views remain in scope.

T01 proves the owned-worker path plus bounded HF feasibility; T02 prepares minimal deployable API/frontend configuration and a preview checklist. T23 finalizes packaging and T24/T25 establish the final deployed release. An explicitly approved early scaffold preview does not require pretending T23/T24 are complete. Reuse tested packaging later.

When a task is externally blocked, its report must identify completed capabilities and the exact unmet prerequisite. T02 may proceed with local scaffolding after verified dataset constraints even if HF account access is blocked; T03-T06 may proceed on verified local scaffolding/contracts/persistence. T07/T09 must independently verify the selected worker path. A missing HF check must not be hidden by laptop results. This is an explicit allowance for independent work, not a waiver of required final checks.

## Latest useful checkpoints (targets, not estimates or promises)

| IST checkpoint | Observable result to seek | If missing |
|---|---|---|
| 17 Oct, 17:00 | Dataset constraints, model-access decision, actual short text/scan/audio inference smoke and chosen worker plan | Record precise access/compatibility issue; settle the viable free route before polishing UI |
| 17 Oct, 20:00 | Durable/authenticated text submission through stored evidence and assessment; deployable skeleton and approval request ready | Treat the demo as at risk; focus remaining effort on the blocking path and ask about any proposed scope change |
| 17 Oct, 23:00 | Text/PDF/audio and assessor evidence/review; first authorized hosted integration checked | Stop adding decorative UI; repair the live flow and persistence/access failures |
| 18 Oct, 02:00 | Similarity, location snapshot/context, all comparison views, clarification/arithmetic and report available; evaluation results recorded | Report incomplete required features explicitly; never silently delete them or relabel fixtures as live |
| 18 Oct, 04:00 | Candidate release on HTTPS, private evidence access, worker restart recovery, limited demo login and backup examples | Prioritize deployment defects/recovery; reserve time for an honest partial-delivery record if necessary |
| 18 Oct, 04:00-06:00 | Fix blocking regressions, verify release, rehearse five-minute demo and finish handoff | Avoid new discretionary features or architectural changes; retain local commits and exact resume state |

If implementation starts after a checkpoint, immediately record elapsed time and reforecast; do not backdate evidence. Continue required work by dependency and report real status. These checkpoints do not reduce security/privacy requirements, cancel T22, or establish a guarantee that the full plan fits the remaining hours. Obtain explicit approval for any scope reduction.

## Keep the demo convincing and measurable

- Center the demonstration on evidence-linked assessment, a useful clarification and transparent revenue/profit arithmetic. Use simple cards, lists and charts.
- Every input format needs an actual live path. Prepare previously processed real examples for slow inference, clearly labeled with when/model/backend; do not fake a live result.
- Measure the laptop cold/warm runtime, peak VRAM/RAM and queue behavior at concurrency one before adding concurrency. Never load all candidate models onto 8 GB VRAM on assumption alone. No large-model fine-tuning.
- Process the 55-file corpus primarily on owned hardware after validation. Cache by input/pipeline/model version and reuse outputs. Budget HF checks against measured remaining quota; the documented free quota is not a corpus-evaluation allocation.
- Use trusted precreated demo logins. Do not rely on last-minute public signup email delivery. Keep real source data private, including in screenshots/reports intended for publication.
- Local directory snapshots must carry source/date/area/coverage labels and attribution. Nominatim public use needs Kartik's explicit informed opt-in; until then prefer confirmed location and licensed snapshots.
- Keep deployment approval separate from local commits. Cloudflare artifact upload and HF Space upload still publish code/artifacts even if no GitHub branch is pushed. Prepare exact destinations and contents for approval.

## Definition of outcomes

**Demo verified:** the recorded hosted URL works with the selected model backend for explicitly listed journeys, private persistence and recovery. State unavailable features, languages and hosted-model targets. This can exist before full backlog completion and must not be presented as all 28 tasks done.

**Full backlog complete:** all 28 reports and acceptance gates, required model deployments, evaluation/scaling evidence, final release checks and consistent tracker/CSV. Unavailable quotas/reviewers/infrastructure remain named blockers. No production-readiness claim follows from a successful five-minute demo.
