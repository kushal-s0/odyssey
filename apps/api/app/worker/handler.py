"""Child-process protocol for trusted, operator-selected model handlers.

Handlers yield {'checkpoint': {...}} and finally {'publish': {...}}. Every
checkpoint waits for the parent API acknowledgement before processing more work.
No API capability/credential or service configuration enters this process.
"""
from __future__ import annotations

import importlib
import json
import sys
import os
import queue
import threading
from collections.abc import Iterator
from typing import Any


def probe(context: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Synthetic orchestration only; cannot process a screening stage."""
    if context['work']['pipeline_version'] != 'orchestration-probe-v1':
        raise ValueError('Probe cannot execute a screening job')
    previous = context['input'].get('checkpoint') or {}
    if not previous.get('probe_checkpoint'):
        yield {'checkpoint': {'probe_checkpoint': True, 'inference': False}}
    yield {'publish': {'probe_checkpoint': True, 'inference': False}}


def main() -> None:
    context = json.loads(sys.stdin.readline())
    module, name = sys.argv[1].split(':', 1)
    function = getattr(importlib.import_module(module), name)
    # Model libraries sometimes write progress to stdout. Keep that output out of
    # the JSON protocol and private source/capabilities out of parent logs.
    channel = sys.stdout
    sys.stdout = sys.stderr
    acknowledgements: queue.Queue[str] = queue.Queue()

    def watch_parent() -> None:
        for line in sys.stdin:
            acknowledgements.put(line.strip())
        # Parent termination closes stdin. Stop an orphaned GPU computation even
        # when it has not yet reached its next checkpoint.
        os._exit(1)

    threading.Thread(target=watch_parent, daemon=True).start()
    published = False
    try:
        for event in function(context):
            if published or not isinstance(event, dict) or len(event) != 1 or not (
                    set(event) <= {'checkpoint','publish','failure'}):
                raise ValueError('Invalid handler event')
            encoded = json.dumps(event, ensure_ascii=False, allow_nan=False)
            if len(encoded.encode()) > 450_000:
                raise ValueError('Handler output exceeds bounds')
            channel.write(encoded+'\n')
            channel.flush()
            if acknowledgements.get() != 'ack':
                return
            if 'publish' in event or 'failure' in event:
                published = True
        if not published:
            raise ValueError('Handler ended without a terminal event')
    except Exception:
        channel.write('{"failure":{"code":"invalid_output"}}\n')
        channel.flush()
        # Do not print model errors/source content to process logs.


if __name__ == '__main__':
    main()
