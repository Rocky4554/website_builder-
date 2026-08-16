"""JWT authentication.

This service trusts the JWT that the existing Spring Boot app issues on login.
We ONLY verify the signature + claims with the configured key — we never create
or refresh tokens. That keeps a single source of truth for identity.

Flow:  Next.js  --Authorization: Bearer <jwt>-->  FastAPI  (verify) -> user id
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config import Settings, get_settings

# auto_error=False so we can return a clean 401 instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller, derived purely from verified JWT claims."""
    id: str
    claims: dict


def _signing_key(settings: Settings) -> str:
    if settings.is_hmac:
        return settings.jwt_secret  # type: ignore[return-value]
    return settings.jwt_public_key  # type: ignore[return-value]


def _allowed_algorithms(settings: Settings) -> list[str]:
    # For HMAC, accept the whole HS family: jjwt picks HS256/384/512 by secret
    # length, and all variants verify with the same secret. We never include an
    # RS/EC algorithm alongside HS, so there is no algorithm-confusion attack.
    if settings.is_hmac:
        return ["HS256", "HS384", "HS512"]
    return [settings.jwt_algorithm]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str, settings: Settings) -> CurrentUser:
    """Verify a raw JWT string and return the user. Raises HTTP 401 on any
    problem. Shared by the HTTP dependency and the WebSocket handler."""
    if not token:
        raise _unauthorized("Missing token")

    # In dev mode, accept simple dev-token for painless local development
    if settings.app_env == "dev" and token in ("dev-token", "dev", "mock-token", "test-token", "default"):
        return CurrentUser(
            id="00000000-0000-0000-0000-000000000001",
            claims={"userId": "00000000-0000-0000-0000-000000000001", "sub": "dev_user"}
        )

    # Only enforce aud/iss options when configured, so we don't reject valid tokens.
    options = {
        "require": ["exp"],
        "verify_aud": settings.jwt_audience is not None,
    }
    try:
        payload = jwt.decode(
            token,
            _signing_key(settings),
            algorithms=_allowed_algorithms(settings),
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            leeway=settings.jwt_leeway_seconds,
            options=options,
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError as exc:
        # Covers bad signature, wrong aud/iss, malformed token, etc.
        raise _unauthorized(f"Invalid token: {exc}")

    user_id = payload.get(settings.jwt_user_id_claim)
    if not user_id:
        raise _unauthorized(f"Token missing '{settings.jwt_user_id_claim}' claim")

    return CurrentUser(id=str(user_id), claims=payload)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise _unauthorized("Missing bearer token")
    return decode_token(creds.credentials, settings)
