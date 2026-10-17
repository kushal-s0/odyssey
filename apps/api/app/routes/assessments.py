from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import TypeAdapter

from ..auth.access import ActorDep, DatabaseDep, resource_access, submission_access
from ..contracts.models import Assessment, Evidence

router=APIRouter(tags=['assessments'])


@router.get('/v1/submissions/{submission_id}/assessment',response_model=Assessment)
def assessment(submission_id: UUID,actor: ActorDep,database: DatabaseDep,
               version: Annotated[int | None, Query(ge=1)] = None) -> Assessment:
    submission=submission_access(database,actor,submission_id)
    with database.transaction(actor.id,read_scoped=True) as c:
        row=c.execute('''SELECT payload FROM public.assessments WHERE submission_id=%s
            AND ((%s::int IS NULL AND input_revision_id=%s) OR version=%s::int)
            ORDER BY version DESC LIMIT 1''',(submission_id,version,submission['current_revision_id'],version)).fetchone()
    if not row:
        raise HTTPException(404,'An assessment is not available yet; check processing status')
    return Assessment.model_validate(row['payload'])


@router.get('/v1/evidence/{evidence_id}',response_model=Evidence)
def evidence(evidence_id: UUID,actor: ActorDep,database: DatabaseDep) -> Evidence:
    row=resource_access(database,actor,'source_segments',evidence_id)
    payload={name:row[name] for name in ('id','submission_id','input_revision_id','kind','original_text',
                                       'english_text','language','translation_uncertain')}
    payload.update(row['locator'])
    if row['attachment_id']:
        payload['attachment_id']=row['attachment_id']
    return TypeAdapter(Evidence).validate_python(payload)
