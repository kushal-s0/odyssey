from fastapi import HTTPException

from ..db.pool import Database


def take_limit(database: Database, key: str, maximum: int, seconds: int) -> None:
    """Atomic, nonblocking shared limit; committed before any provider request."""
    with database.transaction() as c:
        row = c.execute('''INSERT INTO public.shared_limits(key,used) VALUES(%s,1)
            ON CONFLICT(key) DO UPDATE SET
                used=CASE WHEN shared_limits.window_started_at<=clock_timestamp()-make_interval(secs=>%s)
                    THEN 1 ELSE shared_limits.used+1 END,
                window_started_at=CASE WHEN shared_limits.window_started_at<=clock_timestamp()-make_interval(secs=>%s)
                    THEN clock_timestamp() ELSE shared_limits.window_started_at END
            WHERE shared_limits.window_started_at<=clock_timestamp()-make_interval(secs=>%s)
                OR shared_limits.used<%s RETURNING used''', (key, seconds, seconds, seconds, maximum)).fetchone()
    if not row:
        raise HTTPException(429, 'This service is temporarily rate limited. Retry later; your assessment is saved.')
