-- Additive indexes for bounded revision/source cleanup and scoped joins.
-- No table, row, grant, policy or original evidence is removed or rewritten.
CREATE INDEX IF NOT EXISTS versions_parent_revision_idx ON public.submission_versions(parent_revision_id,submission_id);
CREATE INDEX IF NOT EXISTS attachments_submission_idx ON public.attachments(submission_id);
CREATE INDEX IF NOT EXISTS attachments_revision_idx ON public.attachments(input_revision_id,submission_id);
CREATE INDEX IF NOT EXISTS segments_submission_idx ON public.source_segments(submission_id);
CREATE INDEX IF NOT EXISTS segments_attachment_idx ON public.source_segments(attachment_id,submission_id);
CREATE INDEX IF NOT EXISTS business_submission_idx ON public.business_records(submission_id);
CREATE INDEX IF NOT EXISTS jobs_submission_idx ON public.processing_jobs(submission_id);
CREATE INDEX IF NOT EXISTS embeddings_revision_idx ON public.idea_embeddings(input_revision_id,submission_id);
CREATE INDEX IF NOT EXISTS clarifications_submission_idx ON public.clarifications(submission_id);
CREATE INDEX IF NOT EXISTS clarifications_answer_revision_idx ON public.clarifications(answer_revision_id);
CREATE INDEX IF NOT EXISTS reviews_submission_idx ON public.review_actions(submission_id);
CREATE INDEX IF NOT EXISTS reviews_correction_revision_idx ON public.review_actions(correction_revision_id);
