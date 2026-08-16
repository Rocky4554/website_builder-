"""Central configuration, loaded from environment / .env.

Every secret and environment-specific value lives here and comes from the
environment — nothing is hard-coded (same rule we enforce on generated apps).
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_env: Literal["dev", "staging", "prod"] = "dev"
    api_prefix: str = "/api/ai"  # mounted under this so it never clashes with Spring Boot routes

    # --- CORS: exact origins of the Next.js frontend (NO wildcards in prod) ---
    # Stored as a raw comma-separated string (pydantic-settings JSON-parses real
    # list fields, which breaks on bare URLs); use cors_origin_list() to read it.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- JWT (verifies the token Spring Boot issues; we never mint tokens) ---
    # HS* = shared secret (Spring's symmetric signing key). jjwt auto-selects the
    #       HMAC variant by secret length: >=64 bytes -> HS512, >=48 -> HS384,
    #       >=32 -> HS256. The Codex platform uses a 64-byte secret => HS512.
    # RS256 = Spring signs with a private key; we only need the PUBLIC key.
    jwt_algorithm: Literal["HS256", "HS384", "HS512", "RS256"] = "HS512"
    jwt_secret: str | None = None          # required when jwt_algorithm is HS*
    jwt_public_key: str | None = None      # required when jwt_algorithm == RS256 (PEM)
    jwt_issuer: str | None = None          # optional: enforce 'iss' claim
    jwt_audience: str | None = None        # optional: enforce 'aud' claim
    # Codex JWT puts the UUID in "userId"; "sub" holds the username.
    jwt_user_id_claim: str = "userId"
    jwt_leeway_seconds: int = 10           # clock-skew tolerance

    @property
    def is_hmac(self) -> bool:
        return self.jwt_algorithm.startswith("HS")

    # --- Database (defaults to SQLite for local development if not configured) ---
    # Async driver form, e.g. postgresql+asyncpg://user:pass@host:5432/dbname
    database_url: str | None = "sqlite+aiosqlite:///./wb_dev.db"

    # --- LLM ---
    groq_api_key: str | None = None

    # --- Generation workspaces (per-user/per-project folders on disk) ---
    workspaces_dir: str = "workspaces"

    def cors_origin_list(self) -> list[str]:
        """Parsed list of allowed CORS origins."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_runtime(self) -> None:
        """Fail fast at startup if a required secret is missing."""
        if self.is_hmac and not self.jwt_secret:
            if self.app_env == "dev":
                # Default dev secret for seamless local development
                self.jwt_secret = "dev-secret-website-builder-32-chars-long-minimum-hs512"
            else:
                raise RuntimeError(f"JWT_SECRET is required when JWT_ALGORITHM={self.jwt_algorithm}")
        if self.jwt_algorithm == "RS256" and not self.jwt_public_key:
            raise RuntimeError("JWT_PUBLIC_KEY is required when JWT_ALGORITHM=RS256")
        if self.app_env == "prod" and any("*" in o for o in self.cors_origin_list()):
            raise RuntimeError("Wildcard CORS origins are not allowed in prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()
