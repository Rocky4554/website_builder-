"""FastAPI entrypoint for the website-builder AI service.

Run (dev):
    uv run uvicorn backend.main:app --reload --port 8001
"""
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import generate as generate_api
from backend.api import projects as projects_api
from backend.config import get_settings
from backend.security.auth import CurrentUser, get_current_user

logger = logging.getLogger("backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Create our wb_* tables on startup if a DB is configured. Never fatal: the
    # service should still serve /health even when the DB is briefly unreachable.
    if settings.database_url:
        try:
            from backend.db.database import create_all, dispose_engine

            await create_all()
            logger.info("wb_* tables ensured")
        except Exception:  # noqa: BLE001
            logger.exception("DB init failed; continuing (endpoints needing DB will 500)")
        yield
        try:
            await dispose_engine()
        except Exception:  # noqa: BLE001
            logger.exception("engine dispose failed")
    else:
        logger.warning("DATABASE_URL not set; project endpoints will be unavailable")
        yield


def create_app() -> FastAPI:
    settings = get_settings()
    settings.validate_runtime()  # fail fast if a required secret/key is missing

    app = FastAPI(
        title="Website Builder AI Service",
        version="0.1.0",
        docs_url="/docs" if settings.app_env != "prod" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # CORS: only the exact frontend origins, credentials allowed for the JWT header.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # --- Public: liveness probe, no auth (so Spring/infra can health-check it) ---
    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "service": "website-builder-ai", "env": settings.app_env}

    # --- Protected routes live under the api prefix and all require a valid JWT ---
    api = APIRouter(prefix=settings.api_prefix)

    @api.get("/me", tags=["meta"])
    async def me(user: CurrentUser = Depends(get_current_user)) -> dict:
        """Proves the JWT from Spring Boot is accepted and identifies the user."""
        return {"user_id": user.id, "claims": user.claims}

    api.include_router(projects_api.router)
    api.include_router(generate_api.router)
    app.include_router(api)
    return app


app = create_app()
