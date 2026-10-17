from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import sql

from ..contracts.models import Contract
from ..db.pool import Database
from .jwt import AuthenticationUnavailable, InvalidIdentity


class CohortAccess(Contract):
    id: UUID
    name: str
    role: Literal['applicant', 'assessor']


class ActorView(Contract):
    id: UUID
    role: Literal['applicant', 'assessor', 'admin']
    display_name: str | None = None
    cohorts: list[CohortAccess]


def require_database(request: Request) -> Database:
    database: Database | None = getattr(request.app.state, 'database', None)
    if database is None:
        raise HTTPException(503, 'Workspace storage is unavailable; try again shortly')
    return database


DatabaseDep = Annotated[Database, Depends(require_database)]
bearer = HTTPBearer(auto_error=False)


def require_actor(request: Request, database: DatabaseDep,
                  credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> ActorView:
    if credentials is None:
        raise HTTPException(401, 'Sign in to continue')
    try:
        subject = request.app.state.token_verifier.verify(credentials.credentials)
    except InvalidIdentity:
        raise HTTPException(401, 'Your session is invalid or expired; sign in again') from None
    except AuthenticationUnavailable:
        raise HTTPException(503, 'Sign-in verification is temporarily unavailable') from None
    with database.transaction(subject, read_scoped=True) as connection:
        profile = connection.execute('SELECT id,role,display_name FROM public.profiles WHERE id=%s',
                                     (subject,)).fetchone()
        if not profile:
            raise HTTPException(403, 'Ask your coordinator to enable workspace access')
        cohorts = connection.execute('''SELECT c.id,c.name,m.role FROM public.cohort_memberships m
            JOIN public.cohorts c ON c.id=m.cohort_id WHERE m.user_id=%s ORDER BY c.name,c.id''',
                                     (subject,)).fetchall()
    return ActorView(**profile, cohorts=[CohortAccess(**row) for row in cohorts])


ActorDep = Annotated[ActorView, Depends(require_actor)]


def submission_access(database: Database, actor: ActorView, submission_id: UUID,
                      *, action: Literal['read', 'owner', 'review'] = 'read') -> dict[str, Any]:
    with database.transaction(actor.id, read_scoped=True) as connection:
        row = connection.execute('''SELECT id,owner_id,cohort_id,current_revision_id FROM public.submissions
            WHERE id=%s AND deleted_at IS NULL''', (submission_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Submission not found')
    if action == 'owner' and row['owner_id'] != actor.id and actor.role != 'admin':
        raise HTTPException(403, 'Only the owner can change this submission')
    if action == 'review' and not (actor.role == 'admin' or
            (actor.role == 'assessor' and any(c.id == row['cohort_id'] and c.role == 'assessor'
                                            for c in actor.cohorts))):
        raise HTTPException(403, 'Assessor access is required for this cohort')
    return row


def resource_access(database: Database, actor: ActorView, resource: Literal[
        'attachments', 'processing_jobs', 'source_segments', 'assessments', 'review_actions'],
        resource_id: UUID) -> dict[str, Any]:
    # SQL identifiers come only from this fixed allowlist, never a client table name.
    if resource not in {'attachments', 'processing_jobs', 'source_segments', 'assessments', 'review_actions'}:
        raise ValueError('Unsupported resource')
    with database.transaction(actor.id, read_scoped=True) as connection:
        row = connection.execute(sql.SQL('SELECT * FROM public.{} WHERE id=%s').format(
            sql.Identifier(resource)), (resource_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Resource not found')
    return row
