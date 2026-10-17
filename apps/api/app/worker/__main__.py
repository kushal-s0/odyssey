"""Operator-started outbound sessions. Continuous mode runs only until the operator stops it."""
import argparse
import os
import re
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

from ..contracts.worker import WorkerRequest
from .client import WorkerClient
from .manifest import MANIFEST_HASH
from .runtime import execute


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=Path('.env.worker.local'), help='Worker-only private configuration')
    parser.add_argument('--api')
    parser.add_argument('--worker-id')
    parser.add_argument('--allow-loopback', action='store_true')
    parser.add_argument('--session-seconds', type=int, default=900, choices=range(1, 3601), metavar='1..3600')
    parser.add_argument('--idle-seconds', type=int, default=60, choices=range(1, 301), metavar='1..300')
    parser.add_argument('--stage-seconds', type=int, default=120, choices=range(1, 601), metavar='1..600')
    parser.add_argument('--handler', help='Trusted installed Python module:function; model handlers arrive in T09-T12')
    parser.add_argument('--stages', nargs='+', help='Advertise only stages the selected handler implements')
    parser.add_argument('--probe', action='store_true', help='Synthetic orchestration ONLY; never claims screening stages')
    parser.add_argument('--continuous', action='store_true', help='Operator-run owned worker until Ctrl+C; no provider keep-alive')
    args = parser.parse_args()
    private = dotenv_values(args.env_file) if args.env_file.exists() else {}
    if not os.environ.get('HF_TOKEN') and private.get('HF_TOKEN'):
        os.environ['HF_TOKEN'] = private['HF_TOKEN'] or ''
    origin = args.api or os.environ.get('WORKER_API_URL') or private.get('WORKER_API_URL') or ''
    identity = args.worker_id or os.environ.get('WORKER_ID') or private.get('WORKER_ID') or 'owned-laptop'
    credential = os.environ.get('WORKER_CREDENTIAL') or private.get('WORKER_CREDENTIAL') or ''
    if args.probe:
        handler, stages = 'app.worker.handler:probe', ['orchestration:probe']
    else:
        handler, stages = args.handler, args.stages
    if not handler or not stages or not re.fullmatch(r'[a-zA-Z_][\w.]*:[a-zA-Z_]\w*', handler):
        parser.error('Select a trusted handler and supported stages, or use --probe for orchestration verification')
    try:
        client = WorkerClient(origin, credential, allow_loopback=args.allow_loopback)
        worker = WorkerRequest(worker_id=identity, supported_stages=stages, manifest_hash=MANIFEST_HASH)
    except ValueError:
        parser.error('Check worker origin, identity, stages and private WORKER_CREDENTIAL configuration')
    deadline = float('inf') if args.continuous else time.monotonic()+args.session_seconds
    idle_until = float('inf') if args.continuous else time.monotonic()+args.idle_seconds
    backoff = 1.0
    try:
        while time.monotonic() < min(deadline, idle_until):
            try:
                work = client.claim(worker)
                if work:
                    print(f'stage_claimed id={work.stage_id} generation={work.lease_generation}', flush=True)
                    execute(client, work, handler, max_seconds=min(args.stage_seconds, max(1, deadline-time.monotonic())))
                    idle_until = float('inf') if args.continuous else time.monotonic()+args.idle_seconds
                    backoff = 1.0
                else:
                    backoff = min(30.0, backoff*2)
            except httpx.HTTPStatusError as error:
                print(f'worker_http_status={error.response.status_code}', flush=True)
                if error.response.status_code in {401,403,422}:
                    break
                backoff = min(30.0, backoff*2)
            except (httpx.TransportError, ValueError, RuntimeError):
                print('worker_paused retrying_with_bounded_backoff', flush=True)
                backoff = min(30.0, backoff*2)
            time.sleep(max(0, min(backoff, deadline-time.monotonic(), idle_until-time.monotonic())))
    except KeyboardInterrupt:
        print('worker_stopped; durable checkpoints retained', flush=True)
    finally:
        try:
            client.request('POST','/internal/worker/offline',credential,worker.model_dump(mode='json'))
        except (httpx.HTTPError, ValueError):
            pass  # Runtime presence still expires after 90 seconds on network loss.
        client.close()


if __name__ == '__main__':
    main()
