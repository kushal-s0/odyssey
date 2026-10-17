from __future__ import annotations

import hashlib
import json
from uuid import UUID

from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..db.pool import Database


class StageRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def claim(self, worker_id: str, backend: str = "owned_worker", seconds: int = 180,
              max_attempts: int = 3) -> DictRow | None:
        with self.database.transaction() as connection:
            return connection.execute("SELECT * FROM public.claim_stage(%s,%s,%s,%s)",
                                      (worker_id, backend, seconds, max_attempts)).fetchone()

    def heartbeat(self, stage_id: UUID, worker_id: str, generation: int, seconds: int = 180) -> bool:
        with self.database.transaction() as connection:
            row = connection.execute("SELECT public.heartbeat_stage(%s,%s,%s,%s) AS accepted",
                                      (stage_id, worker_id, generation, seconds)).fetchone()
            return bool(row and row["accepted"])

    def publish(self, stage_id: UUID, worker_id: str, generation: int, model_hash: str,
                payload: dict[str, object], schema_version: str = "1") -> bool:
        normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        output_hash = hashlib.sha256(normalized.encode()).hexdigest()
        with self.database.transaction() as connection:
            row = connection.execute("SELECT public.publish_stage(%s,%s,%s,%s,%s,%s,%s) AS published",
                (stage_id, worker_id, generation, output_hash, model_hash, schema_version, Jsonb(payload))).fetchone()
            return bool(row and row["published"])
