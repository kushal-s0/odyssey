from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from ..auth.access import ActorDep, DatabaseDep
from ..contracts.models import Contract
from ..services.deletion import finish_deletion
from ..services.storage import StorageUnavailable

router=APIRouter(tags=['privacy'])


class DeletionRequest(Contract):
    expected_revision_id: UUID


class DeletionResult(Contract):
    status: Literal['deleted','cleanup_pending']


@router.delete('/v1/submissions/{submission_id}', response_model=DeletionResult)
def delete_submission(submission_id: UUID, payload: DeletionRequest, request: Request, response: Response,
                      actor: ActorDep, database: DatabaseDep) -> DeletionResult:
    with database.transaction() as c:
        row=c.execute('SELECT owner_id FROM public.submissions WHERE id=%s',(submission_id,)).fetchone()
        if not row or (row['owner_id']!=actor.id and actor.role!='admin'):
            raise HTTPException(404,'Submission not found')
        # Match the publication lock order; fence every live capability before
        # touching private files. Tombstones survive storage/provider failure.
        c.execute('''SELECT st.id FROM public.job_stages st JOIN public.processing_jobs j ON j.id=st.job_id
            WHERE j.submission_id=%s ORDER BY st.id FOR UPDATE OF st''',(submission_id,)).fetchall()
        c.execute('SELECT id FROM public.processing_jobs WHERE submission_id=%s FOR UPDATE',(submission_id,)).fetchall()
        current=c.execute('SELECT current_revision_id,deleted_at FROM public.submissions WHERE id=%s FOR UPDATE',
                          (submission_id,)).fetchone()
        if not current:
            raise HTTPException(404,'Submission not found')
        if current['current_revision_id']!=payload.expected_revision_id:
            raise HTTPException(409,'A newer revision exists. Review it before deleting this idea.')
        c.execute('UPDATE public.submissions SET deleted_at=coalesce(deleted_at,now()) WHERE id=%s',(submission_id,))
        c.execute("UPDATE public.attachments SET status='deleted' WHERE submission_id=%s",(submission_id,))
        c.execute('''UPDATE public.job_stages SET status='cancelled',lease_generation=lease_generation+1,
            lease_owner=NULL,lease_until=NULL WHERE job_id IN (SELECT id FROM public.processing_jobs
            WHERE submission_id=%s) AND status<>'completed' ''',(submission_id,))
        c.execute("UPDATE public.processing_jobs SET status='cancelled' WHERE submission_id=%s",(submission_id,))
    try:
        complete=finish_deletion(database,request.app.state.settings,submission_id)
    except (StorageUnavailable,httpx.HTTPError,OSError):
        complete=False
    response.status_code=200 if complete else 202
    return DeletionResult(status='deleted' if complete else 'cleanup_pending')
