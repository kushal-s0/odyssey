from uuid import UUID

from fastapi import APIRouter

from ..auth.access import ActorDep, DatabaseDep
from ..contracts.economics import Economics
from ..domain.economics import economics
from .assessments import assessment

router = APIRouter(tags=['financial checks'])


@router.get('/v1/submissions/{submission_id}/economics', response_model=Economics)
def checks(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> Economics:
    return economics(assessment(submission_id, actor, database))
