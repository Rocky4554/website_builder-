from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from backend.config import Settings
from backend.security.auth import decode_token


def _settings(**overrides) -> Settings:
    data = {
        "app_env": "dev",
        "jwt_algorithm": "HS256",
        "jwt_secret": "x" * 32,
        "jwt_user_id_claim": "userId",
    }
    data.update(overrides)
    return Settings(_env_file=None, **data)


def test_dev_token_accepted_in_dev() -> None:
    user = decode_token("dev-token", _settings())
    assert user.id == "00000000-0000-0000-0000-000000000001"


def test_dev_token_rejected_in_prod() -> None:
    settings = _settings(app_env="prod")
    with pytest.raises(HTTPException) as exc:
        decode_token("dev-token", settings)
    assert exc.value.status_code == 401


def test_valid_jwt() -> None:
    settings = _settings()
    token = jwt.encode(
        {
            "userId": "11111111-1111-1111-1111-111111111111",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    user = decode_token(token, settings)
    assert user.id == "11111111-1111-1111-1111-111111111111"


def test_expired_jwt() -> None:
    settings = _settings()
    token = jwt.encode(
        {
            "userId": "11111111-1111-1111-1111-111111111111",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        decode_token(token, settings)
    assert exc.value.status_code == 401
    assert "expired" in exc.value.detail.lower()


def test_wrong_secret() -> None:
    settings = _settings()
    token = jwt.encode(
        {
            "userId": "11111111-1111-1111-1111-111111111111",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    other = _settings(jwt_secret="y" * 32)
    with pytest.raises(HTTPException) as exc:
        decode_token(token, other)
    assert exc.value.status_code == 401
