from __future__ import annotations

import hashlib
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from psycopg.types.json import Jsonb

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..contracts.clarifications import ClarificationBatch, ClarificationQuestion, RevisionView
from ..contracts.models import Assessment, SubmissionAccepted
from ..domain.questions import QUESTIONS, questions
from ..repositories.idempotency import begin_idempotent, finish_idempotent
from ..services.jobs import Jobs
from ..worker.gradio import activity
from ..worker.manifest import initial_stages

router = APIRouter(prefix='/v1/submissions', tags=['clarifications'])


@router.get('/{submission_id}/questions', response_model=list[ClarificationQuestion])
def question_list(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> list[ClarificationQuestion]:
    row = submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        assessment = c.execute('SELECT payload FROM public.assessments WHERE input_revision_id=%s',
                               (row['current_revision_id'],)).fetchone()
    if not assessment:
        raise HTTPException(409, 'Wait for the assessment before answering follow-up questions')
    return questions(Assessment.model_validate(assessment['payload']).business, row['current_revision_id'])


@router.get('/{submission_id}/history', response_model=list[RevisionView])
def history(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> list[RevisionView]:
    submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        rows = c.execute('''SELECT v.id,v.parent_revision_id,v.revision_number,v.input_kind,v.created_at,
            a.id AS attachment_id,ass.version AS assessment_version FROM public.submission_versions v
            LEFT JOIN public.attachments a ON a.input_revision_id=v.id AND a.status='attached'
            LEFT JOIN public.assessments ass ON ass.input_revision_id=v.id
            WHERE v.submission_id=%s ORDER BY v.revision_number DESC LIMIT 50''', (submission_id,)).fetchall()
    return [RevisionView(**row) for row in rows]


@router.post('/{submission_id}/clarifications', response_model=SubmissionAccepted, status_code=202)
def answer(submission_id: UUID, payload: ClarificationBatch, request: Request, actor: ActorDep,
           database: DatabaseDep, idempotency_key: Annotated[str, Header()]) -> SubmissionAccepted:
    submission_access(database, actor, submission_id, action='owner')
    settings = request.app.state.settings
    with database.transaction() as c:
        key, digest, existing = begin_idempotent(c, actor.id, 'clarification:' + str(submission_id),
                                                idempotency_key, payload.model_dump(mode='json'))
        if existing:
            return SubmissionAccepted.model_validate(existing)
        current = c.execute('SELECT * FROM public.submissions WHERE id=%s FOR UPDATE', (submission_id,)).fetchone()
        if not current or current['current_revision_id'] != payload.expected_revision_id:
            raise HTTPException(409, 'This idea has a newer revision. Refresh before answering.')
        previous = c.execute('SELECT * FROM public.submission_versions WHERE id=%s', (payload.expected_revision_id,)).fetchone()
        stored = c.execute('SELECT payload FROM public.assessments WHERE input_revision_id=%s', (payload.expected_revision_id,)).fetchone()
        if not previous or not stored:
            raise HTTPException(409, 'A saved assessment is required before clarification')
        assessment = Assessment.model_validate(stored['payload'])
        available = {q.field: q for q in questions(assessment.business, payload.expected_revision_id)}
        if not set(payload.answers).issubset(available):
            raise HTTPException(422, 'Answer only the requested missing or unresolved fields')
        # Keep original files/revisions intact. A document follow-up is explicitly
        # a text transcript revision; its parent retains the private original.
        source = previous['source_text'] if previous['input_kind'] == 'text' else (
            '[Extracted transcript of the original ' + previous['input_kind'] + '; inspect the original in version history.]\n' +
            '\n'.join(segment.original_text for segment in assessment.evidence))
        additions = '\n\nApplicant follow-up answers (self-reported; not independently verified):\n' + '\n'.join(
            f'{QUESTIONS[field][0]}: {text}' for field, text in payload.answers.items())
        source = (source or '') + additions
        if len(source) > 30000:
            raise HTTPException(422, 'Combined revision exceeds 30,000 characters; shorten the follow-up answers')
        c.execute("SELECT pg_advisory_xact_lock(hashtextextended('job-admission',0))")
        limits = c.execute('''SELECT count(*) AS total,count(*) FILTER(WHERE s.owner_id=%s) AS own
            FROM public.processing_jobs j JOIN public.submissions s ON s.id=j.submission_id
            WHERE j.status NOT IN ('completed','partial','needs_review','failed','cancelled')''', (actor.id,)).fetchone()
        if limits and (limits['total'] >= settings.max_queue_depth or limits['own'] >= settings.max_active_jobs_per_user):
            raise HTTPException(429, 'Wait for an existing submission to finish before reassessment')
        revision, job = uuid4(), uuid4()
        source_hash = hashlib.sha256(source.encode()).hexdigest()
        c.execute('''INSERT INTO public.submission_versions(id,submission_id,revision_number,parent_revision_id,
            input_kind,source_text,input_hash,preferred_language,declared_location,created_by)
            VALUES(%s,%s,%s,%s,'text',%s,%s,%s,%s,%s)''',
            (revision, submission_id, previous['revision_number'] + 1, previous['id'], source, source_hash,
             previous['preferred_language'], Jsonb(previous['declared_location']) if previous['declared_location'] else None, actor.id))
        c.execute("UPDATE public.clarifications SET status='superseded' WHERE submission_id=%s AND status='open'", (submission_id,))
        for field in payload.answers:
            question = available[field]
            c.execute('''INSERT INTO public.clarifications(id,submission_id,input_revision_id,question_key,
                original_question,status,answer_revision_id) VALUES(%s,%s,%s,%s,%s,'answered',%s)''',
                (question.id, submission_id, previous['id'], field, question.question, revision))
        c.execute('UPDATE public.submissions SET current_revision_id=%s,updated_at=now() WHERE id=%s', (revision, submission_id))
        c.execute('''INSERT INTO public.processing_jobs(id,submission_id,input_revision_id,pipeline_version,backend)
            VALUES(%s,%s,%s,'screening-v1',%s)''', (job, submission_id, revision, settings.model_runtime))
        for order, stage in enumerate(initial_stages('text')):
            c.execute('INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash) VALUES(%s,%s,%s,%s)',
                      (job, stage, order, source_hash))
        c.execute("INSERT INTO public.audit_events(resource_id,event_type) VALUES(%s,'clarification_revision_created')", (submission_id,))
        result = SubmissionAccepted(submission_id=submission_id, revision_id=revision, job_id=job)
        finish_idempotent(c, actor.id, 'clarification:' + str(submission_id), key, digest, result.model_dump(mode='json'))
    activity(Jobs(database, settings))
    return result
