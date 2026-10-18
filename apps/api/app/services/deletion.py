"""Durable tombstone first; bounded, retryable private-object and derived-data erasure."""
from uuid import UUID

from ..config import Settings
from ..db.pool import Database
from .storage import configured_storage


def finish_deletion(database: Database, settings: Settings, submission_id: UUID) -> bool:
    with database.transaction() as c:
        row=c.execute('SELECT id FROM public.submissions WHERE id=%s AND deleted_at IS NOT NULL FOR UPDATE SKIP LOCKED',
                      (submission_id,)).fetchone()
        if not row:
            return False
        pending=c.execute('''SELECT id,object_path FROM public.attachments WHERE submission_id=%s
            AND sha256 IS NOT NULL ORDER BY id LIMIT 25''',(submission_id,)).fetchall()
        if pending:
            # Idempotent storage removal precedes recording completion. A crash
            # may repeat deletion, never restore access or report false success.
            configured_storage(settings).delete([item['object_path'] for item in pending])
            c.execute('UPDATE public.attachments SET sha256=NULL WHERE id=ANY(%s)',([item['id'] for item in pending],))
        remaining=c.execute('SELECT 1 FROM public.attachments WHERE submission_id=%s AND sha256 IS NOT NULL LIMIT 1',
                            (submission_id,)).fetchone()
        if remaining:
            return False
        revisions=[r['id'] for r in c.execute('SELECT id FROM public.submission_versions WHERE submission_id=%s',
                                              (submission_id,)).fetchall()]
        c.execute('DELETE FROM public.audit_events WHERE resource_id=ANY(%s)',([submission_id,*revisions],))
        c.execute("DELETE FROM public.api_idempotency WHERE scope LIKE %s OR response->>'submission_id'=%s",
                  ('%'+str(submission_id)+'%',str(submission_id)))
        # All versions, evidence, vectors, explanations, reviews and jobs cascade.
        c.execute('DELETE FROM public.submissions WHERE id=%s',(submission_id,))
        c.execute("INSERT INTO public.audit_events(resource_id,event_type) VALUES(%s,'submission_deleted')",(submission_id,))
    return True
