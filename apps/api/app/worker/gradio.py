"""Bounded Gradio enqueue adapter; PostgreSQL remains the delivery record.

Protocol: https://gradio.app/guides/querying-gradio-apps-with-curl
The configured owned Space exposes run_stage(StageWork JSON). Its CPU wrapper
must use runtime.execute BEFORE any GPU-decorated handler. No input text/file is
placed in the Gradio event. Expired queued events fail closed at /begin; renewed
generations are dispatched by later authorized activity, never an idle pinger.
"""
from __future__ import annotations

import re
import json
import logging
from typing import Any, Literal

import httpx
from fastapi import HTTPException

from ..contracts.worker import StageFailure, StageWork, WorkerRequest
from ..services.jobs import Jobs
from .manifest import MANIFEST_HASH
from .capabilities import Capabilities


class GradioAdapter:
    def __init__(self, origin: str, token: str | None = None, *, transport: httpx.BaseTransport | None = None) -> None:
        if not re.fullmatch(r'https://[a-zA-Z0-9-]+\.hf\.space', origin):
            raise ValueError('Configure an owned hf.space HTTPS origin')
        self.origin, self.token, self.transport = origin, token, transport

    def enqueue(self, work: StageWork) -> str:
        headers = {'Authorization':'Bearer '+self.token} if self.token else {}
        with httpx.Client(timeout=httpx.Timeout(5, connect=3), follow_redirects=False, trust_env=False,
                          transport=self.transport) as client:
            with client.stream('POST', self.origin+'/gradio_api/call/run_stage', headers=headers,
                               json={'data':[work.model_dump_json()]}) as response:
                response.raise_for_status()
                body = b''
                for chunk in response.iter_bytes():
                    body += chunk
                    if len(body) > 4096:
                        raise ValueError('Gradio enqueue response exceeds bounds')
                value = json.loads(body).get('event_id')
                if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,200}', value):
                    raise ValueError('Gradio returned an invalid event receipt')
                return value


def dispatch_one(jobs: Jobs, *, adapter: GradioAdapter | None = None) -> dict[str, Any]:
    config = jobs.settings
    if config.model_runtime != 'hf_zerogpu':
        return {'state':'not_selected'}
    targets = [('text-document', config.text_document_space_url, ['extract:text','extract:pdf','structure','assess']),
               ('speech-translation', config.speech_translation_space_url, ['extract:audio','translate'])]
    for name, origin, stages in targets:
        if not origin:
            continue
        work = jobs.claim(WorkerRequest(worker_id='hf-'+name, supported_stages=stages, manifest_hash=MANIFEST_HASH),
                          backend='hf_zerogpu')
        if not work:
            continue
        with jobs.database.transaction() as c:
            row = c.execute('''INSERT INTO public.runtime_dispatches(stage_id,lease_generation,state)
                VALUES(%s,%s,'enqueuing') ON CONFLICT DO NOTHING RETURNING stage_id''',
                (work.stage_id, work.lease_generation)).fetchone()
        if not row:
            return {'state':'already_dispatched'}
        selected = adapter or GradioAdapter(origin, config.hf_token.get_secret_value() if config.hf_token else None)
        # No blind POST retry: a missing response may still mean the event exists.
        # Lease fencing plus a durable execution record prevents duplicate GPU entry.
        try:
            event_id = selected.enqueue(work)
        except httpx.HTTPStatusError as error:
            status = error.response.status_code
            if status in {401,403,429,503}:
                with jobs.database.transaction() as c:
                    c.execute("UPDATE public.runtime_dispatches SET state='unavailable' WHERE stage_id=%s AND lease_generation=%s",
                              (work.stage_id, work.lease_generation))
                    c.execute("UPDATE public.worker_runtimes SET state='offline' WHERE worker_id=%s", (work.worker_id,))
                retry_header = error.response.headers.get('retry-after', '')
                retry_after = min(86400,max(5,int(retry_header))) if retry_header.isdecimal() and len(retry_header)<8 else 60
                code: Literal['quota_exhausted','runtime_unavailable','model_access_denied'] = (
                    'quota_exhausted' if status==429 else 'runtime_unavailable' if status==503 else 'model_access_denied')
                claims = Capabilities(config.stage_capability_signing_key).verify(work.capability,work.stage_id)
                jobs.fail(claims,StageFailure(code=code, retry_after_seconds=retry_after))
                return {'state':code}
            with jobs.database.transaction() as c:
                c.execute("UPDATE public.runtime_dispatches SET state='uncertain' WHERE stage_id=%s AND lease_generation=%s",
                          (work.stage_id, work.lease_generation))
            return {'state':'uncertain'}
        except (httpx.HTTPError, ValueError):
            with jobs.database.transaction() as c:
                c.execute("UPDATE public.runtime_dispatches SET state='uncertain' WHERE stage_id=%s AND lease_generation=%s",
                          (work.stage_id, work.lease_generation))
            return {'state':'uncertain'}
        with jobs.database.transaction() as c:
            c.execute('''UPDATE public.runtime_dispatches SET state='enqueued',event_id=%s
                WHERE stage_id=%s AND lease_generation=%s''', (event_id, work.stage_id, work.lease_generation))
            c.execute('UPDATE public.job_stages SET event_id=%s WHERE id=%s AND lease_generation=%s',
                      (event_id, work.stage_id, work.lease_generation))
        return {'state':'enqueued'}
    return {'state':'waiting_for_runtime'}


def activity(jobs: Jobs) -> None:
    """Bounded enqueue on real activity. No daemon or artificial keep-alives."""
    jobs.reconcile()
    try:
        dispatch_one(jobs)
    except (HTTPException, httpx.HTTPError, ValueError):
        # An accepted input stays accepted when runtime credentials/access fail.
        logging.getLogger('udyam.api').warning('runtime_dispatch_unavailable')


def run_event(payload: str, api_url: str, handler: str, supported_stages: list[str]) -> dict[str, bool]:
    """CPU wrapper to be bound to the Space's sole public run_stage endpoint.

    Never decorate this wrapper with GPU allocation; only the trusted child
    model handler may allocate a GPU, after runtime.execute's /begin auth check.
    The Space needs neither the claim credential nor a capability signing key.
    """
    from .client import WorkerClient
    from .runtime import execute

    if len(payload) > 16384:
        raise ValueError('Event exceeds stage bounds')
    work = StageWork.model_validate_json(payload)
    if work.backend != 'hf_zerogpu' or work.stage_key not in supported_stages:
        raise ValueError('Event belongs to another runtime')
    client = WorkerClient(api_url)
    try:
        execute(client, work, handler)
    finally:
        client.close()
    return {'finished': True}
