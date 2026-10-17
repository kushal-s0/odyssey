from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..config import Settings
from ..contracts.models import ErrorEnvelope, JobView
from ..contracts.worker import SourceAccess, StageFailure, StageInput, StagePublish, StageWork, WorkerRequest
from ..db.pool import Database
from ..repositories.idempotency import canonical_hash
from ..worker.capabilities import Capabilities
from ..worker.manifest import MANIFEST_HASH
from .storage import configured_storage


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
                    AND r.manifest_hash=%s AND st.status='pending' AND st.retry_at<=clock_timestamp()
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
            # Enforce shared capacity across API replicas, without limiting claim
            # replay by a worker whose response was lost.
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended('worker-capacity:'||%s,0))", (backend,))
            capacity = c.execute('''SELECT count(*) AS active, bool_or(st.lease_owner=%s) AS own
                FROM public.job_stages st JOIN public.processing_jobs j ON j.id=st.job_id
                WHERE j.backend=%s AND st.status='running' AND st.lease_until>clock_timestamp()''',
                (worker.worker_id, backend)).fetchone()
            if capacity and capacity['active'] >= self.settings.max_model_concurrency and not capacity['own']:
                return None
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

    def begin(self, claims: dict[str, Any], execution_id: UUID) -> None:
        with self.database.transaction() as c:
            stage, _ = self.guard(c, claims)
            c.execute('''INSERT INTO public.stage_executions(stage_id,lease_generation,execution_id)
                VALUES(%s,%s,%s) ON CONFLICT DO NOTHING''', (stage['id'], claims['generation'], execution_id))
            row = c.execute('''SELECT execution_id FROM public.stage_executions
                WHERE stage_id=%s AND lease_generation=%s''', (stage['id'], claims['generation'])).fetchone()
            if not row or row['execution_id'] != execution_id:
                raise HTTPException(409, 'This lease already has an execution; wait for expiry before recovery')

    def input(self, claims: dict[str, Any]) -> StageInput:
        with self.database.transaction() as c:
            stage, job = self.guard(c, claims)
            revision = c.execute('SELECT * FROM public.submission_versions WHERE id=%s',
                                 (job['input_revision_id'],)).fetchone()
            attachment = c.execute('''SELECT * FROM public.attachments WHERE input_revision_id=%s
                AND status='attached' ''', (job['input_revision_id'],)).fetchone()
            outputs = c.execute('''SELECT st.stage_key,p.payload FROM public.stage_publications p
                JOIN public.job_stages st ON st.id=p.stage_id WHERE st.job_id=%s AND st.stage_order<%s
                AND st.status='completed' ORDER BY st.stage_order''', (job['id'], stage['stage_order'])).fetchall()
            assert revision
            return StageInput(submission_id=job['submission_id'], input_revision_id=job['input_revision_id'],
                input_kind=revision['input_kind'], source_hash=revision['input_hash'], source_text=revision['source_text'],
                preferred_language=revision['preferred_language'], attachment_id=attachment['id'] if attachment else None,
                media_type=attachment['media_type'] if attachment else None, bytes=attachment['bytes'] if attachment else None,
                pages=attachment['pages'] if attachment else None,
                duration_seconds=float(attachment['duration_seconds']) if attachment and attachment['duration_seconds'] else None,
                previous_outputs={row['stage_key']: row['payload'] for row in outputs}, checkpoint=stage['checkpoint'])

    def source_access(self, claims: dict[str, Any]) -> SourceAccess:
        with self.database.transaction() as c:
            stage, job = self.guard(c, claims)
            attached = c.execute("SELECT 1 FROM public.attachments WHERE input_revision_id=%s AND status='attached'",
                                 (job['input_revision_id'],)).fetchone()
            if not attached:
                raise HTTPException(404, 'This stage has no private source file')
            return SourceAccess(path=f"/internal/worker/{stage['id']}/source/content",
                                sha256=stage['input_hash'], expires_at=stage['lease_until'])

    def source(self, claims: dict[str, Any]) -> tuple[bytes, str]:
        with self.database.transaction() as c:
            _, job = self.guard(c, claims)
            attachment = c.execute("SELECT * FROM public.attachments WHERE input_revision_id=%s AND status='attached'",
                                   (job['input_revision_id'],)).fetchone()
        if not attachment:
            raise HTTPException(404, 'This stage has no private source file')
        data = configured_storage(self.settings).download(attachment['object_path'], self.settings.max_upload_mb*1024*1024)
        if hashlib.sha256(data).hexdigest() != attachment['sha256'] or attachment['sha256'] != claims['input_hash']:
            raise HTTPException(503, 'Stored source integrity could not be verified')
        with self.database.transaction() as c:
            self.guard(c, claims)  # Cancellation/expiry during storage access must not disclose bytes.
        return data, attachment['media_type']

    def guard(self, c: Connection[DictRow], claims: dict[str, Any], *, completed: bool = False) -> tuple[DictRow, DictRow]:
        stage = c.execute('SELECT * FROM public.job_stages WHERE id=%s FOR UPDATE', (claims['stage'],)).fetchone()
        job = c.execute('''SELECT j.*,s.deleted_at FROM public.processing_jobs j
            JOIN public.submissions s ON s.id=j.submission_id WHERE j.id=%s FOR UPDATE OF j''', (claims['job'],)).fetchone()
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

    def control(self, job_id: UUID, *, resume: bool, expected_revision: UUID | None = None) -> None:
        with self.database.transaction() as c:
            # Same lock order as guard/publication, avoiding a cancel/publish race.
            c.execute('SELECT id FROM public.job_stages WHERE job_id=%s ORDER BY id FOR UPDATE', (job_id,)).fetchall()
            job = c.execute('''SELECT j.*,s.current_revision_id FROM public.processing_jobs j
                JOIN public.submissions s ON s.id=j.submission_id WHERE j.id=%s FOR UPDATE OF j''', (job_id,)).fetchone()
            if not job:
                raise HTTPException(404, 'Job not found')
            if job['status'] in {'completed','partial'}:
                raise HTTPException(409, 'A completed job cannot be changed')
            if resume:
                if expected_revision != job['input_revision_id'] or job['current_revision_id'] != expected_revision:
                    raise HTTPException(409, 'The submission revision changed; reload before resuming')
                if job['status'] not in {'cancelled','failed','needs_review','quota_exhausted'}:
                    return  # Repeated resume must not reset an active lease or its retry budget.
                c.execute("SELECT pg_advisory_xact_lock(hashtextextended('job-admission',0))")
                count = c.execute('''SELECT count(*) AS total,count(*) FILTER(WHERE s.owner_id=(
                    SELECT owner_id FROM public.submissions WHERE id=%s)) AS own FROM public.processing_jobs j
                    JOIN public.submissions s ON s.id=j.submission_id WHERE j.id<>%s
                    AND j.status NOT IN ('completed','partial','needs_review','failed','cancelled')''',
                    (job['submission_id'], job_id)).fetchone()
                if count and (count['total'] >= self.settings.max_queue_depth or count['own'] >= self.settings.max_active_jobs_per_user):
                    raise HTTPException(429, 'The processing queue is full; resume after another job finishes')
                c.execute('''UPDATE public.job_stages SET status='pending',attempts=0,retry_at=clock_timestamp(),
                    lease_generation=lease_generation+1,lease_owner=NULL,lease_until=NULL,event_id=NULL,error_code=NULL
                    WHERE job_id=%s AND status IN ('blocked','failed','cancelled')''', (job_id,))
                status = 'waiting_for_worker' if job['backend'] == 'owned_worker' else 'waiting_for_runtime'
                c.execute('''UPDATE public.processing_jobs SET status=%s,error_code=NULL,error_message=NULL,
                    updated_at=clock_timestamp() WHERE id=%s''', (status, job_id))
            else:
                c.execute('''UPDATE public.job_stages SET status='cancelled',lease_generation=lease_generation+1,
                    lease_owner=NULL,lease_until=NULL WHERE job_id=%s AND status<>'completed' ''', (job_id,))
                c.execute("UPDATE public.processing_jobs SET status='cancelled',updated_at=clock_timestamp() WHERE id=%s", (job_id,))

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
            row = c.execute('''SELECT j.id,j.submission_id,j.status,j.backend,j.error_code,j.error_message,j.request_id,
                count(st.id) FILTER(WHERE st.status='completed') AS completed_stages,count(st.id) AS total_stages,
                coalesce(max(st.attempts),0) AS attempt FROM public.processing_jobs j
                JOIN public.job_stages st ON st.job_id=j.id WHERE j.id=%s GROUP BY j.id''', (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Job not found')
        error = ErrorEnvelope(code=row.pop('error_code'), message=row.pop('error_message') or 'Processing paused',
            retryable=row['status'] not in {'completed','cancelled'}, request_id=row.pop('request_id')) if row['error_code'] else None
        row.pop('error_code', None)
        row.pop('error_message', None)
        row.pop('request_id', None)
        return JobView(**row, error=error,
            retry_after_seconds=10 if row['status'] not in {'completed','failed','cancelled','partial'} else None)
