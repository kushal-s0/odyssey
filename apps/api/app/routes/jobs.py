from uuid import UUID

from fastapi import APIRouter, Request

from ..auth.access import ActorDep, DatabaseDep, resource_access, submission_access
from ..contracts.models import JobView
from ..contracts.worker import JobResume
from ..services.jobs import Jobs
from ..worker.gradio import activity

router = APIRouter(prefix='/v1/jobs', tags=['jobs'])


@router.get('/{job_id}', response_model=JobView)
def detail(job_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep) -> JobView:
    resource_access(database, actor, 'processing_jobs', job_id)
    jobs = Jobs(database, request.app.state.settings)
    activity(jobs)
    return jobs.view(job_id)


@router.post('/{job_id}/cancel', response_model=JobView)
def cancel(job_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep) -> JobView:
    row = resource_access(database, actor, 'processing_jobs', job_id)
    submission_access(database, actor, row['submission_id'], action='owner')
    jobs = Jobs(database, request.app.state.settings)
    jobs.control(job_id, resume=False)
    return jobs.view(job_id)


@router.post('/{job_id}/resume', response_model=JobView)
def resume(job_id: UUID, payload: JobResume, request: Request, actor: ActorDep, database: DatabaseDep) -> JobView:
    row = resource_access(database, actor, 'processing_jobs', job_id)
    submission_access(database, actor, row['submission_id'], action='owner')
    jobs = Jobs(database, request.app.state.settings)
    jobs.control(job_id, resume=True, expected_revision=payload.expected_revision_id)
    activity(jobs)
    return jobs.view(job_id)
