from datetime import datetime, timedelta, timezone

from ..db.pool import Database
from .storage import Storage


def cleanup_abandoned(database: Database, storage: Storage, *, hours: int = 24, limit: int = 50) -> int:
    if hours < 24 or not 1 <= limit <= 100:
        raise ValueError('Cleanup must preserve at least 24 hours and use a bounded batch')
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    with database.transaction() as connection:
        rows = connection.execute('''SELECT id,object_path FROM public.attachments
            WHERE submission_id IS NULL AND status IN ('initiated','uploaded') AND created_at<%s
            ORDER BY created_at LIMIT %s FOR UPDATE SKIP LOCKED''', (cutoff, limit)).fetchall()
        if rows:
            # Metadata is retired only after storage deletion succeeds; retry failures later.
            storage.delete([row['object_path'] for row in rows])
            connection.execute("UPDATE public.attachments SET status='deleted' WHERE id=ANY(%s)",
                               ([row['id'] for row in rows],))
        return len(rows)
