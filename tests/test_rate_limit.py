from backend.security.rate_limit import RateLimiter


def test_allows_until_window_is_full() -> None:
    limiter = RateLimiter(max_events=2, window_seconds=60)
    assert limiter.allow("u1") == (True, 0)
    assert limiter.allow("u1") == (True, 0)
    allowed, retry = limiter.allow("u1")
    assert allowed is False
    assert retry >= 1


def test_keys_are_isolated() -> None:
    limiter = RateLimiter(max_events=1, window_seconds=60)
    assert limiter.allow("a")[0] is True
    assert limiter.allow("b")[0] is True
    assert limiter.allow("a")[0] is False
