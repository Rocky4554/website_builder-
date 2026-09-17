import pytest


@pytest.fixture(autouse=True)
def _isolate_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "APP_ENV",
        "JWT_SECRET",
        "JWT_ALGORITHM",
        "JWT_PUBLIC_KEY",
        "JWT_USER_ID_CLAIM",
        "JWT_ISSUER",
        "JWT_AUDIENCE",
        "DATABASE_URL",
        "AGENT_DEBUG",
    ):
        monkeypatch.delenv(key, raising=False)
