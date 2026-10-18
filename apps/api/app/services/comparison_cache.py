"""Bounded disposable aggregate memoization, never authorization or durable state."""
import threading
import time
from collections import OrderedDict
from collections.abc import Callable

from ..contracts.analytics import Analytics


class ComparisonMemo:
    def __init__(self) -> None:
        self.lock=threading.Lock()
        self.values: OrderedDict[str,tuple[float,Analytics]]=OrderedDict()

    def get(self, key: str, calculate: Callable[[],Analytics]) -> Analytics:
        # A cold chart is computed once per instance. Authorization and the DB
        # revision fingerprint have already been checked for every request.
        with self.lock:
            cached=self.values.get(key)
            if cached and time.monotonic()-cached[0]<5:
                self.values.move_to_end(key)
                return cached[1]
            value=calculate()
            self.values[key]=(time.monotonic(),value)
            self.values.move_to_end(key)
            while len(self.values)>32:
                self.values.popitem(last=False)
            return value
