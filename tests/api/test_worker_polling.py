import sys
from types import SimpleNamespace

import httpx
import pytest

from app.worker import __main__ as worker_main


@pytest.mark.parametrize(('origin', 'unavailable', 'expected'), [
    ('http://127.0.0.1:8000', False, [2, 4, 5, 5, 5, 5]),
    ('https://owned.example.test', False, [2, 4, 8, 16, 30, 30]),
    ('http://127.0.0.1:8000', True, [2, 4, 8, 16, 30, 30]),
])
def test_operator_worker_idle_detection_is_faster_only_on_healthy_loopback(monkeypatch, origin, unavailable, expected):
    sleeps, closed = [], []
    class Client:
        def __init__(self, *_args, **_kwargs):
            pass

        def claim(self, _worker):
            if unavailable:
                raise httpx.ConnectError('Synthetic unavailable API')
            return None

        def request(self, *_args, **_kwargs):
            pass

        def close(self):
            closed.append(True)

    def sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) == len(expected):
            raise KeyboardInterrupt

    monkeypatch.setattr(sys, 'argv', ['worker', '--probe', '--api', origin, '--continuous', '--local-poll-seconds', '5'])
    monkeypatch.setattr(worker_main, 'WorkerClient', Client)
    monkeypatch.setattr(worker_main, 'time', SimpleNamespace(monotonic=lambda: 0, sleep=sleep))
    worker_main.main()
    assert sleeps == expected
    assert closed == [True]
