"""Health + version endpoints. Anonymous (no token required) so the Electron
main process and ops tools can probe without bootstrap.
"""

from __future__ import annotations

import platform
import sys
import time

from fastapi import APIRouter

from .. import __version__
from ..docker_client import docker_client
from ..runtime import probe_runtime
from ..schemas import HealthResponse, VersionResponse

router = APIRouter()

_started_at = time.monotonic()


@router.get("/", tags=["meta"])
async def root() -> dict:
    """Friendly landing page so browser hits don't return raw 404 JSON."""
    return {
        "name": "Anty Android Manager — Sidecar",
        "version": __version__,
        "endpoints": {
            "health": "/health",
            "version": "/version",
            "phones": "/phones (requires X-CP-Token)",
        },
        "hint": "Hit /health for a no-auth probe.",
    }


@router.get("/health", response_model=HealthResponse, tags=["meta"])
async def health() -> HealthResponse:
    rt = probe_runtime()
    return HealthResponse(
        version=__version__,
        python=sys.version.split()[0],
        platform=f"{platform.system()} {platform.release()}",
        docker_available=docker_client.is_available(),
        docker_version=docker_client.version,
        runtime_mode=rt.mode,
        runtime_reason=rt.reason,
        binder_available=rt.binder_ok,
        uptime_seconds=time.monotonic() - _started_at,
    )


@router.get("/version", response_model=VersionResponse, tags=["meta"])
async def version() -> VersionResponse:
    return VersionResponse(
        app=__version__,
        python=sys.version.split()[0],
        docker=docker_client.version,
        platform=f"{platform.system()} {platform.release()}",
    )
