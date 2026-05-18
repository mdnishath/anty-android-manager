"""Authentication helpers for sidecar endpoints.

The Electron main process passes a freshly generated token via env. Every
non-health request must echo it back via the `X-CP-Token` header. This makes
sure stray processes on the box can't poke at the local API.
"""

from __future__ import annotations

from fastapi import Header, HTTPException

from .config import settings


async def require_token(x_cp_token: str | None = Header(default=None)) -> None:
    if not settings.ipc_token:
        # Token disabled (dev convenience) — allow anything.
        return
    if x_cp_token != settings.ipc_token:
        raise HTTPException(status_code=401, detail="Bad or missing X-CP-Token")
