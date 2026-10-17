# Committee questions - living evidence-backed answers

## What problem are you solving?

An assessor needs a consistent first understanding of business ideas submitted in regional languages and different formats. The intended workflow preserves originals, structures facts with evidence, explains ratings and asks useful follow-up questions. Refer to task reports for what is implemented at the time of judging.

## Did you train the language/speech/vision models?

No. Those are existing open-weight models selected and self-hosted by the project. T09A implements a separate small answer-relevance experiment; its training data provenance, grouped evaluation and promotion/rejection decision will be recorded. Do not claim a validated custom model until the required evidence exists.

## Why can you deploy for free?

The intended deployment uses free frontend/API/database plans and owned laptop inference. There is no paid inference API or expiring trial-credit requirement. Hosted services still have quotas/sleep behavior and the laptop must stay online. No unlimited throughput or fully cloud-hosted claim is justified.

## Is the supplied dataset a training benchmark?

It is a small collection of scenario examples, including translations and altered answers. It has no business-success labels. We inventory all inputs, keep personal data private, separate related families before splitting and do not train a funding-success predictor.

## What happens when extraction is uncertain?

The design preserves original evidence, alternatives and explicit missing/irrelevant/ambiguous/unreadable states. Unknown values remain null. Verification of the actual implementation must be linked from the relevant task report as those features land.

## Does a high score approve funding?

No. The proposed rubric is a first-level assessment aid requiring human review and later stakeholder calibration. Information completeness is separate from potential, and missing evidence must not become a zero score.

## Which languages have been validated?

English/Hindi human review is available, but availability alone is not completed validation. Marathi, Telugu, Bengali and Odia require fluent reviewers before accuracy/fairness claims. Publish actual sample counts and failure cases.

## What public resources are used?

Only resources with suitable permissions should be incorporated. Model manifests, dependency lockfiles and source records preserve provenance and licenses. Public or synthetic additions are separated from the organizer corpus and held-out real evaluation; they are not presented as independently collected beneficiary data.

## Can an applicant make themselves an assessor?

The API ignores user-editable role metadata. It verifies the signed session and reads roles/cohort assignments from trusted database tables. Local tests cover two applicants and two assigned assessors across separate cohorts, including forged metadata and denied cross-cohort access. Live Supabase account checks remain pending private configuration. See [authentication guide](05-authentication-and-access.md).

## What if the laptop or a model runtime stops?

Inputs, checkpoints and completed outputs live in PostgreSQL. Local checks kill
an actual outbound worker, restart the API and recover its checkpoint with a
higher lease generation; the stale worker cannot publish. Duplicate publication
returns the existing result. Sessions/backoff are bounded and offline/quota
states remain visible. These are orchestration checks with synthetic handlers,
not completed model inference or live HF quota evidence. See [T07](../planning/task-reports/T07.md).

## Does the model process hold the database password?

No. The parent runner uses restricted HTTPS capabilities for one stage; its
model child receives source data and metadata without database/service/signing
keys, bootstrap credentials or API capabilities. Authorization and a durable
execution guard precede model import. Local tests cover this separation and
denied access before model startup. Hosted Space compatibility still needs a
separate actual deployment check.
