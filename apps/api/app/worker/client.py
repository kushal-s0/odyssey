"""Restricted outbound worker transport. No database or storage-service identity."""
from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

from ..contracts.worker import ClaimResponse, StageInput, StageWork, WorkerRequest


def api_origin(value: str, allow_loopback: bool = False) -> str:
    parsed = urlsplit(value)
    if (not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or
            parsed.path not in {'', '/'} or (parsed.scheme != 'https' and not (
                allow_loopback and parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}))):
        raise ValueError('Worker API requires an HTTPS origin; explicit loopback is permitted for local tests')
    return value.rstrip('/')


class WorkerClient:
    def __init__(self, origin: str, credential: str | None = None, *, allow_loopback: bool = False,
                 transport: httpx.BaseTransport | None = None) -> None:
        self.origin = api_origin(origin, allow_loopback)
        if credential is not None and len(credential) < 32:
            raise ValueError('Configure a worker credential of at least 32 characters')
        self.credential = credential
        self.http = httpx.Client(base_url=self.origin, timeout=httpx.Timeout(15, connect=5),
                                 follow_redirects=False, trust_env=False, transport=transport)

    def close(self) -> None:
        self.http.close()

    def request(self, method: str, path: str, token: str, payload: Any = None) -> httpx.Response:
        # Paths are constructed locally; never follow redirects with a capability.
        if not path.startswith('/internal/worker/') or '..' in path or '?' in path or '#' in path:
            raise ValueError('Unrelated worker path')
        for attempt in range(3):
            try:
                response = self.http.request(method, path, headers={'Authorization': 'Bearer '+token}, json=payload)
                # Operations carry stable execution IDs, hashes or lease fencing.
                # A rolled-back database deadlock must not tear down inference.
                if response.status_code not in {500, 502, 503, 504} or attempt == 2:
                    response.raise_for_status()
                    return response
            except httpx.TransportError:
                if attempt == 2:
                    raise
            time.sleep(0.25 * 2**attempt)
        raise RuntimeError('Request retry budget exhausted')

    def claim(self, worker: WorkerRequest) -> StageWork | None:
        if not self.credential:
            raise ValueError('Stage-only clients cannot claim arbitrary jobs')
        return ClaimResponse.model_validate(self.request('POST', '/internal/worker/claim', self.credential,
                                                        worker.model_dump(mode='json')).json()).claim

    def stage(self, work: StageWork, operation: str, payload: Any = None, method: str = 'POST') -> httpx.Response:
        if operation not in {'begin','input','source','heartbeat','checkpoint','publish','failure'}:
            raise ValueError('Unsupported stage operation')
        return self.request(method, f'/internal/worker/{work.stage_id}/{operation}', work.capability, payload)

    def input(self, work: StageWork) -> StageInput:
        value = StageInput.model_validate(self.stage(work, 'input', method='GET').json())
        if value.input_revision_id != work.input_revision_id or value.source_hash != work.input_hash:
            raise ValueError('Claim and revision integrity differ')
        if value.source_text is not None and value.input_kind == 'text':
            if hashlib.sha256(value.source_text.encode()).hexdigest() != work.input_hash:
                raise ValueError('Text source integrity differs')
        return value

    def source(self, work: StageWork, destination: Path, max_bytes: int) -> None:
        access = self.stage(work, 'source').json()
        expected_path = f'/internal/worker/{work.stage_id}/source/content'
        if access['path'] != expected_path or access['sha256'] != work.input_hash:
            raise ValueError('Source access is unrelated to the claim')
        digest, size = hashlib.sha256(), 0
        try:
            with self.http.stream('GET', expected_path, headers={'Authorization': 'Bearer '+work.capability}) as response:
                response.raise_for_status()
                with destination.open('xb') as target:
                    for chunk in response.iter_bytes(65536):
                        size += len(chunk)
                        if size > max_bytes:
                            raise ValueError('Source exceeds processing bounds')
                        digest.update(chunk)
                        target.write(chunk)
            if digest.hexdigest() != work.input_hash:
                raise ValueError('Downloaded source integrity differs')
        except BaseException:
            destination.unlink(missing_ok=True)
            raise
