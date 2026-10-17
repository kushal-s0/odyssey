from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

import jwt
from fastapi import HTTPException
from pydantic import SecretStr


class Capabilities:
    def __init__(self, key: SecretStr | None) -> None:
        value = key.get_secret_value() if key else ''
        if len(value) < 32:
            raise HTTPException(503, 'Worker capability signing is not configured')
        self.key = value

    def issue(self, stage: dict[str, Any], job: dict[str, Any], manifest: str) -> str:
        until: datetime = stage['lease_until']
        claims = {'iss':'udyam-stage-service','aud':'udyam-stage-worker','sub':stage['lease_owner'],
            'stage':str(stage['id']),'job':str(stage['job_id']), 'revision':str(job['input_revision_id']),
            'generation':stage['lease_generation'],'pipeline':job['pipeline_version'],
            'input_hash':stage['input_hash'],'manifest':manifest,
            'iat':int(datetime.now().timestamp()),'exp':int(until.timestamp())+30}
        return jwt.encode(claims, self.key, algorithm='HS256', headers={'typ':'stage-capability'})

    def verify(self, token: str, stage_id: UUID) -> dict[str, Any]:
        try:
            if len(token) > 8192 or jwt.get_unverified_header(token).get('typ') != 'stage-capability':
                raise ValueError('Invalid capability')
            claims = jwt.decode(token, self.key, algorithms=['HS256'], issuer='udyam-stage-service',
                audience='udyam-stage-worker', options={'require':['exp','iat','sub','stage','job','revision',
                    'generation','pipeline','input_hash','manifest'], 'strict_aud':True})
            if claims['stage'] != str(stage_id) or type(claims['generation']) is not int:
                raise ValueError('Unrelated capability')
            return claims
        except (jwt.PyJWTError, ValueError, KeyError, TypeError):
            raise HTTPException(401, 'Stage capability is invalid or expired') from None
