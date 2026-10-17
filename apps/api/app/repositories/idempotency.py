import hashlib
import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb


def canonical_hash(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def begin_idempotent(connection: Connection[DictRow], owner: UUID, scope: str,
                     key: str, payload: Any) -> tuple[str, str, dict[str, Any] | None]:
    if not 16 <= len(key) <= 128 or not key.isascii() or not all(c.isalnum() or c in '-_' for c in key):
        raise HTTPException(422, 'Provide a unique Idempotency-Key of 16–128 letters, digits, hyphens or underscores')
    key_hash, request_hash = hashlib.sha256(key.encode()).hexdigest(), canonical_hash(payload)
    connection.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',
                       (str(owner)+':'+scope+':'+key_hash,))
    row = connection.execute('''SELECT request_hash,response FROM public.api_idempotency
        WHERE owner_id=%s AND scope=%s AND key_hash=%s''', (owner, scope, key_hash)).fetchone()
    if row and row['request_hash'] != request_hash:
        raise HTTPException(409, 'This request key was already used for different input')
    return key_hash, request_hash, row['response'] if row else None


def finish_idempotent(connection: Connection[DictRow], owner: UUID, scope: str, key_hash: str,
                      request_hash: str, response: dict[str, Any]) -> None:
    connection.execute('''INSERT INTO public.api_idempotency(owner_id,scope,key_hash,request_hash,response)
        VALUES(%s,%s,%s,%s,%s)''', (owner, scope, key_hash, request_hash, Jsonb(response)))
