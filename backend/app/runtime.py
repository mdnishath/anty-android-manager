"""Runtime detection — figure out at startup whether we can actually run
redroid containers on this host, or whether we should fall back to a
simulated lifecycle so the frontend stays useful for development.

A real run needs all of:
- Docker reachable (named pipe / socket)
- Host kernel has Android binder + ashmem (or memfd) support

If any of those is missing we operate in `simulated` mode. Both modes
expose the same `start/stop/list/status` interface so the rest of the API
doesn't care.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import structlog

from .docker_client import docker_client

log = structlog.get_logger(__name__)

Mode = Literal["real", "simulated", "unavailable"]


@dataclass(frozen=True)
class RuntimeInfo:
    mode: Mode
    docker_ok: bool
    binder_ok: bool
    reason: str  # human-readable explanation


_cached: RuntimeInfo | None = None


def probe_runtime(force: bool = False) -> RuntimeInfo:
    """Decide which runtime to use. Cached after first call."""
    global _cached
    if _cached is not None and not force:
        return _cached

    docker_ok = docker_client.is_available()
    binder_ok = False
    reason_parts: list[str] = []

    if not docker_ok:
        reason_parts.append("Docker not reachable")
    else:
        binder_ok = _probe_binder()
        if not binder_ok:
            reason_parts.append("kernel missing binder/binderfs")

    if docker_ok and binder_ok:
        mode: Mode = "real"
        reason = "redroid containers ready"
    elif docker_ok:
        mode = "simulated"
        reason = "; ".join(reason_parts) + " — running in simulation mode"
    else:
        mode = "unavailable"
        reason = "; ".join(reason_parts)

    _cached = RuntimeInfo(mode=mode, docker_ok=docker_ok, binder_ok=binder_ok, reason=reason)
    log.info("runtime.probed", **_cached.__dict__)
    return _cached


def _probe_binder() -> bool:
    """Spin up a throwaway alpine container and look for binderfs in /proc.

    Failing-open: if we can't decide either way, return False so we err on the
    side of simulation.
    """
    client = docker_client.client
    if client is None:
        return False
    try:
        out = client.containers.run(
            "alpine:latest",
            command=[
                "sh",
                "-c",
                "cat /proc/filesystems 2>/dev/null | grep -q binder && echo BINDER_OK || echo BINDER_NO",
            ],
            remove=True,
            stderr=False,
            stdout=True,
            privileged=False,
        )
        text = out.decode("utf-8", errors="ignore").strip() if isinstance(out, bytes) else str(out)
        return "BINDER_OK" in text
    except Exception as exc:  # noqa: BLE001
        log.warning("runtime.binder_probe.failed", error=str(exc))
        return False
