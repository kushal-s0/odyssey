from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..config import Settings
from ..contracts.models import JobView
from ..contracts.worker import StageFailure, StagePublish, StageWork, WorkerRequest
from ..db.pool import Database
from ..repositories.idempotency import canonical_hash
from ..worker.capabilities import Capabilities
from ..worker.manifest import MANIFEST_HASH


class Jobs:
    def __init__(self, database: Database, settings: Settings) -> None:
        self.database, self.settings = database, settings

    def reconcile(self) -> None:
        with self.database.transaction() as c:
            c.execute('''UPDATE public.job_stages st SET
                status=CASE WHEN st.attempts>=%s THEN 'failed' ELSE 'pending' END,
                lease_owner=NULL,lease_until=NULL,error_code='lease_expired',retry_at=clock_timestamp()
                FROM public.processing_jobs j WHERE j.id=st.job_id AND st.status='running'
                AND st.lease_until<=clock_timestamp() AND j.status NOT IN ('completed','partial','cancelled','failed')''',
                (self.settings.max_job_attempts,))
            c.execute('''UPDATE public.processing_jobs j SET status='failed',error_code='retry_budget_exhausted',
                error_message='Processing stopped after repeated failures. Review and explicitly resume.',updated_at=clock_timestamp()
                WHERE j.status NOT IN ('completed','partial','cancelled','failed','needs_review','quota_exhausted')
                AND EXISTS(SELECT 1 FROM public.job_stages st WHERE st.job_id=j.id AND st.status='failed')''')
            c.execute('''UPDATE public.processing_jobs j SET status=CASE
                WHEN EXISTS(SELECT 1 FROM public.worker_runtimes r JOIN public.job_stages st
                    ON st.job_id=j.id AND st.stage_key=ANY(r.supported_stages)
                    WHERE r.backend=j.backend AND r.state<>'offline' AND r.last_seen>clock_timestamp()-interval '90 seconds'
                    AND r.manifest_hash=%s AND st.status='pending'
                    AND NOT EXISTS(SELECT 1 FROM public.job_stages prior WHERE prior.job_id=j.id
                        AND prior.stage_order<st.stage_order AND prior.status<>'completed')) THEN 'queued'
                WHEN j.backend='owned_worker' THEN 'waiting_for_worker' ELSE 'waiting_for_runtime' END
                WHERE j.status IN ('queued','waiting_for_worker','waiting_for_runtime','extracting','translating','structuring','assessing','enriching')
                AND NOT EXISTS(SELECT 1 FROM public.job_stages st WHERE st.job_id=j.id AND st.status='running')
                AND EXISTS(SELECT 1 FROM public.job_stages st WHERE st.job_id=j.id AND st.status='pending')''',
                (MANIFEST_HASH,))

    def work(self, stage: DictRow, job: DictRow) -> StageWork:
        return StageWork(job_id=stage['job_id'], stage_id=stage['id'],
            lease_generation=stage['lease_generation'], lease_expires_at=stage['lease_until'],
            capability=Capabilities(self.settings.stage_capability_signing_key).issue(stage, job, MANIFEST_HASH),
            input_revision_id=job['input_revision_id'], pipeline_version=job['pipeline_version'],
            input_hash=stage['input_hash'], stage_key=stage['stage_key'], model_manifest_hash=MANIFEST_HASH,
            worker_id=stage['lease_owner'], backend=job['backend'])

    def claim(self, worker: WorkerRequest, backend: str = 'owned_worker') -> StageWork | None:
        Capabilities(self.settings.stage_capability_signing_key)
        if worker.manifest_hash != MANIFEST_HASH:
            raise HTTPException(409, 'Worker pipeline manifest differs from the API; update the worker before resuming')
        self.reconcile()
        with self.database.transaction() as c:
            c.execute('''INSERT INTO public.worker_runtimes(worker_id,backend,supported_stages,manifest_hash,state)
                VALUES(%s,%s,%s,%s,'idle') ON CONFLICT(worker_id) DO UPDATE SET
                backend=EXCLUDED.backend,supported_stages=EXCLUDED.supported_stages,manifest_hash=EXCLUDED.manifest_hash,
                state='idle',last_seen=clock_timestamp()''',
                (worker.worker_id, backend, worker.supported_stages, worker.manifest_hash))
            stage = c.execute('SELECT * FROM public.claim_compatible_stage(%s,%s,%s,%s,%s)',
                (worker.worker_id, backend, self.settings.lease_seconds, self.settings.max_job_attempts,
                 worker.supported_stages)).fetchone()
            if not stage:
                return None
            c.execute("UPDATE public.worker_runtimes SET state='busy' WHERE worker_id=%s", (worker.worker_id,))
            job = c.execute('SELECT * FROM public.processing_jobs WHERE id=%s', (stage['job_id'],)).fetchone()
            assert job
            return self.work(stage, job)

    def guard(self, c: Connection[DictRow], claims: dict[str, Any], *, completed: bool = False) -> tuple[DictRow, DictRow]:
        stage = c.execute('SELECT * FROM public.job_stages WHERE id=%s FOR UPDATE', (claims['stage'],)).fetchone()
        job = c.execute('''SELECT j.*,s.deleted_at FROM public.processing_jobs j
            JOIN public.submissions s ON s.id=j.submission_id WHERE j.id=%s''', (claims['job'],)).fetchone()
        if not stage or not job or job['deleted_at'] or job['status'] in {'cancelled','failed'}:
            raise HTTPException(409, 'Stage was cancelled, replaced or is unavailable')
        if (str(stage['job_id']) != claims['job'] or str(job['input_revision_id']) != claims['revision'] or
                stage['lease_owner'] != claims['sub'] or stage['lease_generation'] != claims['generation'] or
                stage['input_hash'] != claims['input_hash'] or job['pipeline_version'] != claims['pipeline'] or
                claims['manifest'] != MANIFEST_HASH):
            raise HTTPException(409, 'Stage claim is stale or unrelated')
        if not (completed and stage['status'] == 'completed') and (
                stage['status'] != 'running' or stage['lease_until'] <= datetime.now(timezone.utc)):
            raise HTTPException(409, 'Stage lease expired; reclaim before processing')
        return stage, job

    def heartbeat(self, claims: dict[str, Any]) -> StageWork:
        with self.database.transaction() as c:
            stage, job = self.guard(c, claims)
            renewed = c.execute('''UPDATE public.job_stages SET lease_until=clock_timestamp()+make_interval(secs=>%s)
                WHERE id=%s RETURNING *''', (self.settings.lease_seconds, stage['id'])).fetchone()
            assert renewed
            c.execute("UPDATE public.worker_runtimes SET state='busy',last_seen=clock_timestamp() WHERE worker_id=%s",
                      (claims['sub'],))
            return self.work(renewed, job)

    def checkpoint(self, claims: dict[str, Any], payload: dict[str, Any]) -> None:
        self.bound_output(payload)
        with self.database.transaction() as c:
            stage, _ = self.guard(c, claims)
            c.execute('UPDATE public.job_stages SET checkpoint=%s WHERE id=%s', (Jsonb(payload), stage['id']))

    @staticmethod
    def bound_output(payload: dict[str, Any]) -> None:
        try:
            if len(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()) > 450_000:
                raise ValueError('Output too large')
        except (ValueError, TypeError, RecursionError):
            raise HTTPException(422, 'Stage output exceeds the supported bounds') from None

    def publish(self, claims: dict[str, Any], output: StagePublish) -> dict[str, Any]:
        self.bound_output(output.payload)
        if output.model_manifest_hash != MANIFEST_HASH:
            raise HTTPException(409, 'Output model manifest differs from the authorized stage')
        with self.database.transaction() as c:
            stage, job = self.guard(c, claims, completed=True)
            digest = canonical_hash(output.payload)
            if stage['status'] == 'completed':
                previous = c.execute('SELECT * FROM public.stage_publications WHERE stage_id=%s', (stage['id'],)).fetchone()
                if not previous or previous['output_hash'] != digest or previous['model_manifest_hash'] != output.model_manifest_hash:
                    raise HTTPException(409, 'Conflicting duplicate stage publication')
                return {'published':False, 'status':job['status']}
            c.execute('SELECT public.publish_stage(%s,%s,%s,%s,%s,%s,%s)',
                (stage['id'], claims['sub'], claims['generation'], digest, output.model_manifest_hash,
                 output.schema_version, Jsonb(output.payload)))
            remaining = c.execute("SELECT 1 FROM public.job_stages WHERE job_id=%s AND status<>'completed' LIMIT 1",
                                  (job['id'],)).fetchone()
            status = 'queued' if remaining else 'completed'
            if not remaining and job['pipeline_version'] == 'screening-v1':
                # T12 must validate/persist the final typed assessment in this transaction.
                assessment = c.execute('SELECT 1 FROM public.assessments WHERE input_revision_id=%s AND pipeline_version=%s',
                                       (job['input_revision_id'], job['pipeline_version'])).fetchone()
                if not assessment:
                    raise HTTPException(422, 'A validated assessment must be published before this job can complete')
            c.execute('UPDATE public.processing_jobs SET status=%s,error_code=NULL,error_message=NULL,updated_at=clock_timestamp() WHERE id=%s',
                      (status, job['id']))
            return {'published':True, 'status':status}

    def fail(self, claims: dict[str, Any], failure: StageFailure) -> None:
        with self.database.transaction() as c:
            stage, job = self.guard(c, claims)
            retry = failure.code in {'runtime_unavailable','stage_timeout','model_unhealthy'} and stage['attempts'] < self.settings.max_job_attempts
            status = 'pending' if retry else 'blocked' if failure.code in {'quota_exhausted','needs_review','model_access_denied'} else 'failed'
            job_status = ('waiting_for_worker' if job['backend']=='owned_worker' else 'waiting_for_runtime') if retry else (
                'quota_exhausted' if failure.code=='quota_exhausted' else 'needs_review' if status=='blocked' else 'failed')
            c.execute('''UPDATE public.job_stages SET status=%s,error_code=%s,retry_at=clock_timestamp()+make_interval(secs=>%s),
                lease_owner=NULL,lease_until=NULL WHERE id=%s''',
                (status, failure.code, failure.retry_after_seconds, stage['id']))
            c.execute('''UPDATE public.processing_jobs SET status=%s,error_code=%s,
                error_message='Processing paused. Review the reported state and explicitly resume if needed.',
                updated_at=clock_timestamp() WHERE id=%s''', (job_status, failure.code, job['id']))

    def view(self, job_id: UUID) -> JobView:
        with self.database.transaction() as c:
            row = c.execute('''SELECT j.id,j.submission_id,j.status,j.backend,
                count(st.id) FILTER(WHERE st.status='completed') AS completed_stages,count(st.id) AS total_stages,
                coalesce(max(st.attempts),0) AS attempt FROM public.processing_jobs j
                JOIN public.job_stages st ON st.job_id=j.id WHERE j.id=%s GROUP BY j.id''', (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Job not found')
        return JobView(**row, retry_after_seconds=10 if row['status'] not in {'completed','failed','cancelled','partial'} else None)
