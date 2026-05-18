"""FastAPI application entrypoint.

Run with:
    uvicorn backend.app.main:app --host 127.0.0.1 --port 38080

The Electron main process spawns us; see `electron/sidecar.ts`.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .routers import health, phones


def _setup_logging() -> None:
    log_level = settings.log_level.upper()
    logging.basicConfig(
        level=log_level,
        stream=sys.stdout,
        format="%(message)s",
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(log_level)),
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    _setup_logging()
    log = structlog.get_logger(__name__)
    log.info(
        "sidecar.startup",
        version=__version__,
        host=settings.host,
        port=settings.port,
        token_required=bool(settings.ipc_token),
    )
    # Single ready signal that the Electron sidecar manager watches for —
    # don't change the wording without updating that detector.
    print(f"CP_SIDECAR_READY port={settings.port} version={__version__}", flush=True)
    try:
        yield
    finally:
        log.info("sidecar.shutdown")


app = FastAPI(
    title="CloudPhone Manager Sidecar",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs" if settings.log_level == "debug" else None,
    redoc_url=None,
)

# CORS — Electron renderer fetches from `http://localhost:5173` in dev and
# `file://` in production. Both fail the Same-Origin check, so we need permissive
# CORS. The actual auth is the X-CP-Token header, not the Origin, so this is
# safe enough for a token-protected local-network API.
_cors_origins = list(settings.cors_origins) if settings.cors_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

app.include_router(health.router)
app.include_router(phones.router)
