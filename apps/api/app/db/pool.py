from __future__ import annotations

from contextlib import contextmanager
from collections.abc import Iterator
from uuid import UUID

from psycopg import Connection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import ConnectionPool

from ..config import Settings


class Database:
    def __init__(self, settings: Settings) -> None:
        if not settings.database_url or not settings.database_url.get_secret_value():
            raise ValueError("DATABASE_URL is required for persistence")
        kwargs: dict[str, object] = {"row_factory": dict_row, "connect_timeout": 5,
            "options": "-c statement_timeout=10000 -c search_path=public,extensions", "prepare_threshold": None}
        if settings.app_env == "production":
            kwargs["sslmode"] = "require"
        self.pool: ConnectionPool[Connection[DictRow]] = ConnectionPool(
            settings.database_url.get_secret_value(), min_size=settings.database_pool_min,
            max_size=settings.database_pool_max, timeout=5, open=False,
            kwargs=kwargs)

    def open(self) -> None:
        self.pool.open(wait=True, timeout=10)

    def close(self) -> None:
        self.pool.close()

    @contextmanager
    def transaction(self, subject: UUID | None = None, *, read_scoped: bool = False) -> Iterator[Connection[DictRow]]:
        with self.pool.connection() as connection, connection.transaction():
            if subject:
                connection.execute("SELECT set_config('request.jwt.claim.sub',%s,true)", (str(subject),))
            if read_scoped:
                if not subject:
                    raise ValueError("Scoped reads require a verified subject")
                connection.execute("SET LOCAL ROLE authenticated")
            yield connection

    def ready(self) -> bool:
        try:
            with self.transaction() as connection:
                row = connection.execute("SELECT to_regclass('public.submissions') AS table_name").fetchone()
                return bool(row and row["table_name"])
        except Exception:
            return False
