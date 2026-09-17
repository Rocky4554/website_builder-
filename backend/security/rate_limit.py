"""Simple in-memory token window for generation requests.

Good enough for a single-process FastAPI worker. Reset on process restart.
"""
from __future__ import annotations

import threading
import time


class RateLimiter:
    def __init__(self, max_events: int = 5, window_seconds: int = 300) -> None:
        self.max_events = max_events
        self.window = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        now = time.time()
        with self._lock:
            times = [t for t in self._hits.get(key, []) if now - t < self.window]
            if len(times) >= self.max_events:
                retry = int(self.window - (now - times[0])) + 1
                self._hits[key] = times
                return False, max(retry, 1)
            times.append(now)
            self._hits[key] = times
            return True, 0


# 5 generations per 5 minutes per user.
generation_limiter = RateLimiter(max_events=5, window_seconds=300)
