from __future__ import annotations

import asyncio
import hashlib
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from ..auth.access import ActorDep, ActorView, DatabaseDep, resource_access
from ..config import Settings
from ..contracts.uploads import UploadCompleted, UploadInitiate, UploadInitiated
from ..db.pool import Database
from ..repositories.idempotency import begin_idempotent, finish_idempotent
from ..services.media import inspect_media
from ..services.storage import configured_storage

router = APIRouter(prefix='/v1/uploads', tags=['private uploads'])


@router.post('', response_model=UploadInitiated, status_code=201)
def initiate(payload: UploadInitiate, request: Request, actor: ActorDep, database: DatabaseDep,
             idempotency_key: Annotated[str, Header()]) -> UploadInitiated:
    settings: Settings = request.app.state.settings
    if payload.bytes > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, 'File exceeds the upload size limit')
    configured_storage(settings)  # Fail before recording intent when storage is unconfigured.
    with database.transaction() as connection:
        key, digest, existing = begin_idempotent(connection, actor.id, 'upload', idempotency_key,
                                                  payload.model_dump(mode='json'))
        if existing:
            previous = connection.execute('SELECT status,created_at,submission_id FROM public.attachments WHERE id=%s',
                                          (existing['attachment_id'],)).fetchone()
            if not previous or previous['status'] == 'deleted' or (previous['submission_id'] is None and
                    previous['created_at'] < datetime.now(timezone.utc)-timedelta(hours=24)):
                raise HTTPException(410, 'This upload expired; start a new upload with a new request key')
            return UploadInitiated.model_validate(existing)
        connection.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', ('uploads:'+str(actor.id),))
        count = connection.execute('''SELECT count(*) AS n FROM public.attachments WHERE owner_id=%s
            AND submission_id IS NULL AND status IN ('initiated','uploaded')''', (actor.id,)).fetchone()
        if count and count['n'] >= 5:
            raise HTTPException(429, 'Finish your pending uploads before adding another file')
        attachment = uuid4()
        object_path = f'{actor.id}/{attachment}/original'
        connection.execute('''INSERT INTO public.attachments
            (id,owner_id,object_path,filename_display,media_type,bytes,status,bucket)
            VALUES(%s,%s,%s,%s,%s,%s,'initiated',%s)''',
            (attachment, actor.id, object_path, payload.filename, payload.media_type,
             payload.bytes, settings.private_upload_bucket))
        result = UploadInitiated(attachment_id=attachment, upload_path=f'/v1/uploads/{attachment}/complete')
        finish_idempotent(connection, actor.id, 'upload', key, digest, result.model_dump(mode='json'))
        return result


def own_attachment(database: Database, actor: ActorView, attachment: UUID) -> dict[str, Any]:
    row = resource_access(database, actor, 'attachments', attachment)
    if row['owner_id'] != actor.id:
        raise HTTPException(404, 'Upload not found')
    if row['submission_id'] is None and row['created_at'] < datetime.now(timezone.utc)-timedelta(hours=24):
        raise HTTPException(410, 'This upload expired; start a new upload')
    return row


def persist_upload(database: Database, actor: ActorView, attachment: UUID, path: Path,
                   digest: str, settings: Settings) -> UploadCompleted:
    row = own_attachment(database, actor, attachment)
    metadata = inspect_media(path, row['media_type'], settings)
    with database.transaction() as connection:
        current = connection.execute('SELECT * FROM public.attachments WHERE id=%s FOR UPDATE',
                                     (attachment,)).fetchone()
        if not current or current['owner_id'] != actor.id or current['status'] == 'deleted':
            raise HTTPException(404, 'Upload not found')
        if current['bytes'] != path.stat().st_size:
            raise HTTPException(422, 'Upload size changed; start a new upload')
        if current['status'] in {'uploaded', 'attached'}:
            if current['sha256'] != digest:
                raise HTTPException(409, 'This upload already contains different file contents')
        else:
            configured_storage(settings).upload_file(current['object_path'], path, current['media_type'])
            connection.execute('''UPDATE public.attachments SET sha256=%s,pages=%s,duration_seconds=%s,
                status='uploaded' WHERE id=%s''',
                (digest, metadata['pages'], metadata['duration_seconds'], attachment))
        return UploadCompleted(attachment_id=attachment, sha256=digest, media_type=current['media_type'],
            bytes=current['bytes'], pages=metadata['pages'], duration_seconds=metadata['duration_seconds'])


@router.put('/{attachment_id}/complete', response_model=UploadCompleted)
async def complete(attachment_id: UUID, request: Request, actor: ActorDep,
                   database: DatabaseDep) -> UploadCompleted:
    row = await run_in_threadpool(own_attachment, database, actor, attachment_id)
    settings: Settings = request.app.state.settings
    if row['bytes'] > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, 'File exceeds the upload size limit')
    content_type = request.headers.get('content-type', '').split(';', 1)[0].strip().lower()
    if content_type != row['media_type']:
        raise HTTPException(415, 'Upload Content-Type must match the initiated file type')
    length = request.headers.get('content-length')
    if length is not None and (not length.isdecimal() or int(length) != row['bytes']):
        raise HTTPException(413, 'Upload length must match the declared file size')
    path: Path | None = None
    digest, size = hashlib.sha256(), 0
    try:
        with tempfile.NamedTemporaryFile(prefix='udyam-upload-', delete=False) as output:
            path = Path(output.name)
            async with asyncio.timeout(60):
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > row['bytes']:
                        raise HTTPException(413, 'File exceeds the declared upload size')
                    output.write(chunk)
                    digest.update(chunk)
        if size != row['bytes']:
            raise HTTPException(422, 'Upload was incomplete; retry with the original file')
        return await run_in_threadpool(persist_upload, database, actor, attachment_id, path,
                                       digest.hexdigest(), settings)
    except TimeoutError:
        raise HTTPException(408, 'Upload timed out; retry on a stable connection') from None
    finally:
        if path:
            path.unlink(missing_ok=True)


@router.get('/{attachment_id}/content')
def content(attachment_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep) -> Response:
    row = resource_access(database, actor, 'attachments', attachment_id)
    if row['status'] not in {'uploaded', 'attached'}:
        raise HTTPException(409, 'This upload is not ready')
    settings: Settings = request.app.state.settings
    data = configured_storage(settings).download(row['object_path'], settings.max_upload_mb*1024*1024)
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise HTTPException(503, 'Stored source integrity could not be verified')
    # Deletion may have tombstoned the source during object-storage I/O.
    resource_access(database,actor,'attachments',attachment_id)
    return Response(data, media_type=row['media_type'], headers={
        'Content-Disposition': 'attachment; filename="original"', 'Content-Security-Policy': "sandbox; default-src 'none'"})


@router.delete('/{attachment_id}', status_code=204)
def abandon(attachment_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep) -> Response:
    resource_access(database, actor, 'attachments', attachment_id)
    with database.transaction() as connection:
        row = connection.execute('SELECT * FROM public.attachments WHERE id=%s FOR UPDATE', (attachment_id,)).fetchone()
        if not row or row['owner_id'] != actor.id:
            raise HTTPException(404, 'Upload not found')
        if row['submission_id'] is not None:
            raise HTTPException(409, 'An attached original cannot be removed through upload cancellation')
        configured_storage(request.app.state.settings).delete([row['object_path']])
        connection.execute("UPDATE public.attachments SET status='deleted' WHERE id=%s", (attachment_id,))
    return Response(status_code=204)
