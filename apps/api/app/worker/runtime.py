from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from ..contracts.worker import StageWork
from ..worker.manifest import MANIFEST_HASH
from .client import WorkerClient


def model_environment() -> dict[str, str]:
    allowed = {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA',
               'HF_HOME','HF_HUB_CACHE','HF_TOKEN','TRANSFORMERS_CACHE','CUDA_VISIBLE_DEVICES',
               'CUDA_PATH','PYTHONPATH','PYTHONIOENCODING','OMP_NUM_THREADS'}
    environment={key: value for key, value in os.environ.items() if key.upper() in allowed}
    environment['PYTHONIOENCODING']='utf-8'
    return environment


def execute(client: WorkerClient, work: StageWork, handler: str, *, max_seconds: float = 120,
            heartbeat_seconds: float = 15, temp_root: Path | None = None) -> None:
    if work.model_manifest_hash != MANIFEST_HASH:
        raise ValueError('Worker manifest differs')
    # The API verifies capability, current lease and duplicate-delivery exclusion
    # BEFORE the handler is imported or the GPU model process is created.
    client.stage(work, 'begin', {'execution_id': str(uuid4())})
    value = client.input(work)
    with tempfile.TemporaryDirectory(prefix='udyam-stage-', dir=temp_root) as folder:
        source = Path(folder)/'original'
        if value.attachment_id and value.input_kind != 'text':
            client.source(work, source, 25*1024*1024)
        work = StageWork.model_validate(client.stage(work, 'heartbeat').json())
        safe_work = work.model_dump(mode='json', exclude={'capability','worker_id','lease_expires_at'})
        context = {'work':safe_work, 'input':value.model_dump(mode='json'),
                   'source_path':str(source) if source.exists() else None}
        process = subprocess.Popen([sys.executable, '-B', '-m', 'app.worker.handler', handler],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding='utf-8', env=model_environment(),
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        events: queue.Queue[str | None] = queue.Queue(maxsize=2)

        def read_events() -> None:
            assert process.stdout
            while True:
                line = process.stdout.readline(450_002)
                if not line:
                    events.put(None)
                    return
                events.put(line)
                if len(line) > 450_000:
                    return

        reader = threading.Thread(target=read_events, daemon=True)
        reader.start()
        started, heartbeat_at = time.monotonic(), time.monotonic()
        watchdog_stop = threading.Event()

        def lease_watchdog() -> None:
            while not watchdog_stop.wait(.2):
                if (work.lease_expires_at <= datetime.now(timezone.utc) or
                        time.monotonic()-started > max_seconds):
                    if process.poll() is None:
                        process.terminate()
                    return

        watchdog = threading.Thread(target=lease_watchdog, daemon=True)
        watchdog.start()
        try:
            assert process.stdin
            process.stdin.write(json.dumps(context, ensure_ascii=False)+'\n')
            process.stdin.flush()
            while True:
                now = time.monotonic()
                if now-started > max_seconds:
                    client.stage(work, 'failure', {'code':'stage_timeout'})
                    return
                if now-heartbeat_at >= heartbeat_seconds:
                    work = StageWork.model_validate(client.stage(work, 'heartbeat').json())
                    heartbeat_at = time.monotonic()
                if work.lease_expires_at <= datetime.now(timezone.utc):
                    raise RuntimeError('Lease expired during model execution')
                try:
                    line = events.get(timeout=0.2)
                except queue.Empty:
                    continue
                if line is None:
                    client.stage(work, 'failure', {'code':'stage_timeout' if time.monotonic()-started >= max_seconds
                                                   else 'model_unhealthy'})
                    return
                if len(line.encode()) > 450_000:
                    raise ValueError('Handler response exceeds bounds')
                event: dict[str, Any] = json.loads(line)
                if len(event) != 1:
                    raise ValueError('Invalid handler event')
                if 'checkpoint' in event:
                    client.stage(work, 'checkpoint', {'payload':event['checkpoint']})
                elif 'publish' in event:
                    client.stage(work, 'publish', {'model_manifest_hash':MANIFEST_HASH, 'payload':event['publish']})
                elif 'failure' in event:
                    client.stage(work, 'failure', event['failure'])
                else:
                    raise ValueError('Invalid handler event')
                process.stdin.write('ack\n')
                process.stdin.flush()
                if 'publish' in event or 'failure' in event:
                    return
        except ValueError:
            client.stage(work, 'failure', {'code':'invalid_output'})
        finally:
            watchdog_stop.set()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            for stream in (process.stdin, process.stdout):
                if stream:
                    stream.close()
            reader.join(timeout=1)
            watchdog.join(timeout=1)
