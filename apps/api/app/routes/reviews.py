from __future__ import annotations

import hashlib
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Request
from psycopg.types.json import Jsonb

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..contracts.models import Assessment, JobStatus, Trade
from ..contracts.workspace import QueueItem, QueuePage, ReviewInput, ReviewView
from ..repositories.idempotency import begin_idempotent, finish_idempotent
from ..services.jobs import Jobs
from ..worker.gradio import activity
from ..worker.manifest import initial_stages

router = APIRouter(tags=['review'])


@router.get('/v1/review-queue', response_model=QueuePage)
def queue(actor: ActorDep, database: DatabaseDep, limit: Annotated[int, Query(ge=1, le=50)] = 20,
          offset: Annotated[int, Query(ge=0, le=10000)] = 0, status: JobStatus | None = None,
          cohort_id: UUID | None = None, trade: Trade | None = None,
          search: Annotated[str, Query(max_length=120)] = '', unreviewed: bool = False) -> QueuePage:
    if actor.role not in {'assessor', 'admin'}:
        raise HTTPException(403, 'An assessor account is required')
    where = ['s.deleted_at IS NULL']
    params: list[object] = []
    if status:
        where.append('j.status=%s')
        params.append(status.value)
    if cohort_id:
        where.append('s.cohort_id=%s')
        params.append(cohort_id)
    if trade:
        where.append('a.trade=%s')
        params.append(trade.value)
    if search.strip():
        where.append("coalesce(a.payload->'business'->'offer'->>'value','') ILIKE %s")
        params.append('%' + search.strip().replace('%', '\\%').replace('_', '\\_') + '%')
    if unreviewed:
        where.append('NOT EXISTS(SELECT 1 FROM public.review_actions r WHERE r.input_revision_id=v.id)')
    base = ''' FROM public.submissions s JOIN public.submission_versions v ON v.id=s.current_revision_id
        JOIN public.processing_jobs j ON j.input_revision_id=v.id
        LEFT JOIN public.assessments a ON a.input_revision_id=v.id
        LEFT JOIN public.cohorts c ON c.id=s.cohort_id WHERE ''' + ' AND '.join(where)
    with database.transaction(actor.id, read_scoped=True) as c:
        count = c.execute('SELECT count(*) AS n' + base, params).fetchone()
        rows = c.execute('''SELECT s.id,v.id AS revision_id,s.cohort_id,c.name AS cohort_name,
            (s.synthetic OR coalesce(c.synthetic,false)) AS synthetic,
            coalesce(a.payload->'business'->'offer'->>'value','Unassessed idea') AS title,
            v.input_kind,v.preferred_language AS language,j.status,a.potential,
            a.completeness_percent AS completeness,coalesce(a.ranking_eligible,false) AS ranking_eligible,a.trade,
            EXISTS(SELECT 1 FROM public.review_actions r WHERE r.input_revision_id=v.id) AS reviewed,s.created_at'''
            + base + ' ORDER BY s.created_at DESC,s.id LIMIT %s OFFSET %s', [*params, limit, offset]).fetchall()
    return QueuePage(items=[QueueItem(**row) for row in rows], total=count['n'] if count else 0,
                     limit=limit, offset=offset)


@router.get('/v1/submissions/{submission_id}/reviews', response_model=list[ReviewView])
def reviews(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> list[ReviewView]:
    submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        rows = c.execute('''SELECT id,input_revision_id,outcome,reason,correction_revision_id,created_at
            FROM public.review_actions WHERE submission_id=%s ORDER BY created_at DESC LIMIT 100''', (submission_id,)).fetchall()
    return [ReviewView(**row) for row in rows]


@router.post('/v1/submissions/{submission_id}/reviews', response_model=ReviewView, status_code=201)
def review(submission_id: UUID, payload: ReviewInput, request: Request, actor: ActorDep, database: DatabaseDep,
           idempotency_key: Annotated[str, Header()]) -> ReviewView:
    submission_access(database, actor, submission_id, action='review')
    settings = request.app.state.settings
    with database.transaction() as c:
        key, digest, existing = begin_idempotent(c, actor.id, 'review:' + str(submission_id),
                                                idempotency_key, payload.model_dump(mode='json'))
        if existing:
            return ReviewView.model_validate(existing)
        current = c.execute('SELECT current_revision_id FROM public.submissions WHERE id=%s FOR UPDATE', (submission_id,)).fetchone()
        if not current or current['current_revision_id'] != payload.expected_revision_id:
            raise HTTPException(409, 'This idea has a newer revision. Refresh before reviewing.')
        correction_revision = None
        if payload.replace_transcript and not (payload.source_verified and payload.correction_text):
            raise HTTPException(422, 'Replacing the transcript requires a complete correction and explicit source verification')
        if payload.correction_text or payload.source_verified:
            previous = c.execute('SELECT * FROM public.submission_versions WHERE id=%s', (payload.expected_revision_id,)).fetchone()
            stored = c.execute('SELECT payload FROM public.assessments WHERE input_revision_id=%s', (payload.expected_revision_id,)).fetchone()
            if not previous or not stored:
                raise HTTPException(409, 'Wait for a saved assessment before correcting its interpretation')
            assessment = Assessment.model_validate(stored['payload'])
            source = previous['source_text'] if previous['input_kind'] == 'text' else (
                '[Extracted transcript; original document retained in the parent revision.]\n' +
                '\n'.join(segment.original_text for segment in assessment.evidence))
            if payload.replace_transcript:
                source = '[Reviewer-corrected business transcript; original retained in the parent revision.]\n' + (payload.correction_text or '')
            elif payload.correction_text:
                source = (source or '') + '\n\nReviewer correction (requires fresh assessment; verify against the original):\n' + payload.correction_text
            else:
                source = (source or '') + '\n\n[The reviewer checked this transcript against the original source. Business claims remain self-reported.]'
            if len(source) > 30000:
                raise HTTPException(422, 'Combined correction exceeds the 30,000 character revision limit')
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended('job-admission',0))")
            limits = c.execute('''SELECT count(*) AS total,count(*) FILTER(WHERE s.owner_id=(
                SELECT owner_id FROM public.submissions WHERE id=%s)) AS own
                FROM public.processing_jobs j JOIN public.submissions s ON s.id=j.submission_id
                WHERE j.status NOT IN ('completed','partial','needs_review','failed','cancelled')''', (submission_id,)).fetchone()
            if limits and (limits['total'] >= settings.max_queue_depth or limits['own'] >= settings.max_active_jobs_per_user):
                raise HTTPException(429, 'Wait for current processing to finish before applying a correction')
            correction_revision, job = uuid4(), uuid4()
            source_hash = hashlib.sha256(source.encode()).hexdigest()
            c.execute('''INSERT INTO public.submission_versions(id,submission_id,revision_number,parent_revision_id,
                input_kind,source_text,input_hash,preferred_language,declared_location,created_by)
                VALUES(%s,%s,%s,%s,'text',%s,%s,%s,%s,%s)''', (correction_revision, submission_id,
                previous['revision_number'] + 1, previous['id'], source, source_hash, previous['preferred_language'],
                Jsonb(previous['declared_location']) if previous['declared_location'] else None, actor.id))
            c.execute('UPDATE public.submissions SET current_revision_id=%s,updated_at=now() WHERE id=%s', (correction_revision, submission_id))
            c.execute('''INSERT INTO public.processing_jobs(id,submission_id,input_revision_id,pipeline_version,backend)
                VALUES(%s,%s,%s,'screening-v1',%s)''', (job, submission_id, correction_revision, settings.model_runtime))
            for order, stage in enumerate(initial_stages('text')):
                c.execute('INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash) VALUES(%s,%s,%s,%s)',
                          (job, stage, order, source_hash))
        row = c.execute('''INSERT INTO public.review_actions(submission_id,input_revision_id,actor_id,outcome,reason,correction_revision_id)
            VALUES(%s,%s,%s,%s,%s,%s) RETURNING id,input_revision_id,outcome,reason,correction_revision_id,created_at''',
            (submission_id, payload.expected_revision_id, actor.id, payload.outcome, payload.reason, correction_revision)).fetchone()
        assert row is not None
        result = ReviewView(**row)
        if payload.source_verified:
            c.execute('''INSERT INTO public.audit_events(actor_id,resource_id,event_type,safe_metadata)
                VALUES(%s,%s,'source_transcript_verified',%s)''',
                (actor.id,payload.expected_revision_id,Jsonb({'review_id':str(result.id),
                    'correction_revision_id':str(correction_revision),'replaced_transcript':payload.replace_transcript})))
        c.execute("INSERT INTO public.audit_events(actor_id,resource_id,event_type) VALUES(%s,%s,'assessment_reviewed')", (actor.id, submission_id))
        finish_idempotent(c, actor.id, 'review:' + str(submission_id), key, digest, result.model_dump(mode='json'))
    if correction_revision:
        activity(Jobs(database, settings))
    return result
