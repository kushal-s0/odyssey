# Follow-up answers

Questions come from unresolved typed business fields, not invented model facts. The server derives stable question IDs from the input revision. Applicant answers create a linked text revision and a normal durable job. Idempotency keys make retries safe; the expected revision rejects stale answers. A PDF/audio parent's transcript is explicitly labelled as extracted, while the parent retains its private file. Scan uncertainty carries into descendants so answering one field cannot quietly certify unreviewed handwriting.

Potential, evidence coverage and information completeness remain separate. More answers can expose a business weakness as well as fill gaps; a higher score is not guaranteed. Questions currently use English and text answers. Localized/audio follow-ups remain incomplete.


## Completion pass: localized and audio follow-ups

The API serves prepared questions in English, Hindi, Marathi, Telugu, Bengali and Odia. Non-English copy is bundled under data/localization/questions.json with provider provenance, an English original and a pending-human-review label. No beneficiary text is used to prepare these generic translations; runtime questions do not require a provider call.

A follow-up accepts either up to three typed answers or one private audio upload associated with the current question fields. It uses the existing validated upload, worker transcription, translation and reassessment stages. Ready uploads must belong to the actor and cannot already be attached. The API creates a child revision atomically, with existing admission/idempotency/stale protection. No new migration or credential is needed.

Parent evidence is rebound to the child with original source revision/segment IDs. The API reconstructs the expected inherited evidence from its saved parent assessment; workers cannot alter it, forge ancestry or drop it. Existing English renderings are reused exactly. Original files remain accessible through authorized version history. New ASR remains unverified and cannot clear a source-review gate.

Explicit typed answers retain their assigned question and exact English source quote. Deterministic number/currency/unknown/conflict/instruction checks still apply, and conflicting figures remain unresolved. This repair followed an actual model test that omitted a clearly supplied startup investment; completed processing alone was insufficient acceptance. See followup-initial-failure.json and the later full pipeline report.
