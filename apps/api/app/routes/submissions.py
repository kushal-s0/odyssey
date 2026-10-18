from __future__ import annotations

import hashlib
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Request
from psycopg.types.json import Jsonb

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..auth.scope import submission_scope
from ..contracts.models import SubmissionAccepted, SubmissionCreate
from ..contracts.uploads import SubmissionView
from ..repositories.idempotency import begin_idempotent, finish_idempotent
from ..worker.manifest import initial_stages
from ..services.jobs import Jobs
from ..worker.gradio import activity

router = APIRouter(prefix='/v1/submissions', tags=['submissions'])
PIPELINE_VERSION = 'screening-v1'
SELECT_VIEW = '''SELECT s.id,s.synthetic,s.cohort_id,v.id AS revision_id,v.revision_number,v.input_kind,
    v.preferred_language,v.source_text,a.id AS attachment_id,j.id AS job_id,j.status,s.created_at
    FROM public.submissions s JOIN public.submission_versions v ON v.id=s.current_revision_id
    JOIN public.processing_jobs j ON j.input_revision_id=v.id
    LEFT JOIN public.attachments a ON a.input_revision_id=v.id AND a.status='attached' '''


@router.post('', response_model=SubmissionAccepted, status_code=202)
def create(payload: SubmissionCreate, request: Request, actor: ActorDep, database: DatabaseDep,
           idempotency_key: Annotated[str, Header()]) -> SubmissionAccepted:
    if actor.role not in {'applicant', 'admin'}:
        raise HTTPException(403, 'An applicant account is required to submit an idea')
    settings = request.app.state.settings
    Jobs(database, settings).reconcile()
    with database.transaction() as connection:
        key, request_hash, existing = begin_idempotent(connection, actor.id, 'submission', idempotency_key,
                                                      payload.model_dump(mode='json'))
        if existing:
            return SubmissionAccepted.model_validate(existing)
        if payload.cohort_id:
            member = connection.execute('''SELECT 1 FROM public.cohort_memberships
                WHERE user_id=%s AND cohort_id=%s AND role='applicant' ''',
                (actor.id, payload.cohort_id)).fetchone()
            if not member and actor.role != 'admin':
                raise HTTPException(403, 'You are not assigned to this cohort')
        connection.execute("SELECT pg_advisory_xact_lock(hashtextextended('job-admission',0))")
        limits = connection.execute('''SELECT count(*) AS total,count(*) FILTER(WHERE s.owner_id=%s) AS own
            FROM public.processing_jobs j JOIN public.submissions s ON s.id=j.submission_id
            WHERE j.status NOT IN ('completed','partial','needs_review','failed','cancelled')''', (actor.id,)).fetchone()
        if limits and (limits['total'] >= settings.max_queue_depth or limits['own'] >= settings.max_active_jobs_per_user):
            raise HTTPException(429, 'The processing queue is full. Wait for an existing submission to finish.')
        attachment = None
        kind, source_text = 'text', payload.text
        if payload.attachment_ids:
            attachment = connection.execute('''SELECT * FROM public.attachments
                WHERE id=%s AND owner_id=%s AND status='uploaded' AND submission_id IS NULL
                AND created_at>=now()-interval '24 hours' FOR UPDATE''',
                (payload.attachment_ids[0], actor.id)).fetchone()
            if not attachment or not attachment['sha256']:
                raise HTTPException(404, 'Ready upload not found')
            kind = 'pdf' if attachment['media_type'] == 'application/pdf' else 'audio'
        digest = attachment['sha256'] if attachment else hashlib.sha256((source_text or '').encode()).hexdigest()
        submission, revision, job = uuid4(), uuid4(), uuid4()
        # User-provided families may deduplicate only that user's synthetic inputs.
        # Prefixing prevents collisions with real source families or other owners.
        family = f'demo:{actor.id}:{payload.scenario_family}' if payload.scenario_family else None
        connection.execute('''INSERT INTO public.submissions(id,owner_id,cohort_id,synthetic,family_id)
            VALUES(%s,%s,%s,%s,%s)''', (submission, actor.id, payload.cohort_id, payload.synthetic, family))
        connection.execute('''INSERT INTO public.submission_versions
            (id,submission_id,revision_number,input_kind,source_text,input_hash,preferred_language,declared_location,created_by)
            VALUES(%s,%s,1,%s,%s,%s,%s,%s,%s)''',
            (revision, submission, kind, source_text, digest, payload.preferred_language,
             Jsonb(payload.declared_location.model_dump(mode='json')) if payload.declared_location else None, actor.id))
        connection.execute('UPDATE public.submissions SET current_revision_id=%s WHERE id=%s', (revision, submission))
        if attachment:
            connection.execute('''UPDATE public.attachments SET submission_id=%s,input_revision_id=%s,
                status='attached' WHERE id=%s''', (submission, revision, attachment['id']))
        connection.execute('''INSERT INTO public.processing_jobs
            (id,submission_id,input_revision_id,pipeline_version,backend) VALUES(%s,%s,%s,%s,%s)''',
            (job, submission, revision, PIPELINE_VERSION, settings.model_runtime))
        for order, stage_key in enumerate(initial_stages(kind)):
            connection.execute('''INSERT INTO public.job_stages(job_id,stage_key,stage_order,input_hash)
                VALUES(%s,%s,%s,%s)''', (job, stage_key, order, digest))
        result = SubmissionAccepted(submission_id=submission, revision_id=revision, job_id=job)
        finish_idempotent(connection, actor.id, 'submission', key, request_hash, result.model_dump(mode='json'))
    activity(Jobs(database, settings))
    return result


@router.get('', response_model=list[SubmissionView])
def listing(actor: ActorDep, database: DatabaseDep,
            limit: Annotated[int, Query(ge=1, le=100)] = 20,
            offset: Annotated[int, Query(ge=0, le=10000)] = 0) -> list[SubmissionView]:
    scope,params=submission_scope(actor)
    with database.transaction(actor.id, read_scoped=True) as connection:
        rows = connection.execute(SELECT_VIEW+f'''WHERE s.deleted_at IS NULL AND {scope}
            ORDER BY s.created_at DESC,s.id LIMIT %s OFFSET %s''', (*params,limit,offset)).fetchall()
    return [SubmissionView(**row) for row in rows]


@router.get('/{submission_id}', response_model=SubmissionView)
def detail(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> SubmissionView:
    submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as connection:
        row = connection.execute(SELECT_VIEW+'WHERE s.id=%s', (submission_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Submission not found')
    return SubmissionView(**row)
