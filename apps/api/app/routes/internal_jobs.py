from __future__ import annotations

import secrets
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials

from ..auth.access import DatabaseDep, bearer
from ..contracts.worker import (ClaimResponse, ExecutionAccepted, SourceAccess, StageBegin,
    StageCheckpoint, StageFailure, StageInput, StagePublish, StageReceipt, StageWork, WorkerRequest)
from ..services.jobs import Jobs
from ..worker.capabilities import Capabilities
from ..worker.gradio import activity, dispatch_one

router = APIRouter(prefix='/internal/worker', tags=['restricted worker'])
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def require_worker(request: Request, credentials: Credentials) -> None:
    secret = request.app.state.settings.worker_credential
    expected = secret.get_secret_value() if secret else ''
    if len(expected) < 32:
        raise HTTPException(503, 'Worker access is not configured')
    supplied = credentials.credentials if credentials else ''
    if not secrets.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(401, 'Worker credential is invalid')


def capability(stage_id: UUID, request: Request, credentials: Credentials) -> dict[str, Any]:
    if not credentials:
        raise HTTPException(401, 'A stage capability is required')
    return Capabilities(request.app.state.settings.stage_capability_signing_key).verify(
        credentials.credentials, stage_id)


Claims = Annotated[dict[str, Any], Depends(capability)]


@router.post('/claim', response_model=ClaimResponse, dependencies=[Depends(require_worker)])
def claim(payload: WorkerRequest, request: Request, database: DatabaseDep) -> ClaimResponse:
    return ClaimResponse(claim=Jobs(database, request.app.state.settings).claim(payload))


@router.post('/offline', status_code=204, dependencies=[Depends(require_worker)])
def offline(payload: WorkerRequest, database: DatabaseDep) -> Response:
    with database.transaction() as c:
        c.execute("UPDATE public.worker_runtimes SET state='offline' WHERE worker_id=%s AND backend='owned_worker'",
                  (payload.worker_id,))
    return Response(status_code=204)


@router.post('/dispatch', dependencies=[Depends(require_worker)])
def dispatch(request: Request, database: DatabaseDep) -> dict[str, Any]:
    return dispatch_one(Jobs(database, request.app.state.settings))


@router.post('/{stage_id}/begin', response_model=ExecutionAccepted)
def begin(stage_id: UUID, payload: StageBegin, claims: Claims, request: Request,
          database: DatabaseDep) -> ExecutionAccepted:
    Jobs(database, request.app.state.settings).begin(claims, payload.execution_id)
    return ExecutionAccepted()


@router.get('/{stage_id}/input', response_model=StageInput)
def stage_input(stage_id: UUID, claims: Claims, request: Request, database: DatabaseDep) -> StageInput:
    return Jobs(database, request.app.state.settings).input(claims)


@router.post('/{stage_id}/source', response_model=SourceAccess)
def source_access(stage_id: UUID, claims: Claims, request: Request, database: DatabaseDep) -> SourceAccess:
    jobs = Jobs(database, request.app.state.settings)
    return jobs.source_access(claims)


@router.get('/{stage_id}/source/content')
def source_content(stage_id: UUID, claims: Claims, request: Request, database: DatabaseDep) -> Response:
    content, media_type = Jobs(database, request.app.state.settings).source(claims)
    return Response(content, media_type=media_type, headers={'Content-Disposition': 'attachment; filename="original"',
        'Content-Security-Policy': "sandbox; default-src 'none'"})


@router.post('/{stage_id}/heartbeat', response_model=StageWork)
def heartbeat(stage_id: UUID, claims: Claims, request: Request, database: DatabaseDep) -> StageWork:
    # The existing capability must still be valid and the lease live. Expired
    # leases are reclaimed with a new generation through /claim, never revived.
    return Jobs(database, request.app.state.settings).heartbeat(claims)


@router.post('/{stage_id}/checkpoint', status_code=204)
def checkpoint(stage_id: UUID, payload: StageCheckpoint, claims: Claims, request: Request,
               database: DatabaseDep) -> Response:
    Jobs(database, request.app.state.settings).checkpoint(claims, payload.payload)
    return Response(status_code=204)


@router.post('/{stage_id}/publish', response_model=StageReceipt)
def publish(stage_id: UUID, payload: StagePublish, claims: Claims, request: Request,
            database: DatabaseDep) -> StageReceipt:
    jobs = Jobs(database, request.app.state.settings)
    receipt = StageReceipt(**jobs.publish(claims, payload))
    activity(jobs)
    return receipt


@router.post('/{stage_id}/failure', status_code=204)
def failure(stage_id: UUID, payload: StageFailure, claims: Claims, request: Request,
            database: DatabaseDep) -> Response:
    Jobs(database, request.app.state.settings).fail(claims, payload)
    return Response(status_code=204)
