# Assessor workflow

The same assessment component serves applicants and assessors. The queue is a bounded SQL query executed under the caller's Supabase row-level-security identity. It never retrieves unrelated cohorts and filters later in the browser. Applicants cannot open the queue or post reviews. A trusted coordinator must assign assessor roles and cohort memberships.

Review decisions are immutable actions with reasons and expected input revisions. Corrections add attributed source text to a new revision, preserve the original file and prior decisions, and queue the normal evidence/extraction/scoring stages. Old similarity/context/explanations do not silently become current because all current reads are tied to the revision/assessment. Human correction notes can conflict with originals: the pipeline must retain that uncertainty, rather than claiming independent verification.
