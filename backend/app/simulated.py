"""Simulated container lifecycle. Used when the host can't actually run
redroid (no binder kernel, no Docker, etc). Mirrors the public surface of
`redroid.py` so callers don't have to branch.

Each simulated phone has:
- a state machine: stopped → starting → running → stopping → stopped
- a fake ADB port allocation
- realistic-ish boot time (~3s) so the UI shows the spinner
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import structlog

from .schemas import PhoneInstance

log = structlog.get_logger(__name__)

BOOT_SECONDS = 3.0
SHUTDOWN_SECONDS = 1.0
ADB_PORT_START = 5555


@dataclass
class FakeContainer:
    phone_id: str
    name: str
    image: str
    platform: str
    adb_port: int
    state: str = "created"  # created, running, exited
    started_at: float = 0.0


_lock = threading.RLock()
_containers: dict[str, FakeContainer] = {}
_next_port = ADB_PORT_START


def _allocate_port() -> int:
    global _next_port
    used = {c.adb_port for c in _containers.values()}
    while _next_port in used:
        _next_port += 1
    p = _next_port
    _next_port += 1
    return p


def container_name(phone_id: str) -> str:
    return f"cp-sim-{phone_id}"


def start_container(phone: PhoneInstance, default_image: str | None = None) -> FakeContainer:
    with _lock:
        existing = _containers.get(phone.id)
        if existing and existing.state == "running":
            return existing
        port = existing.adb_port if existing else _allocate_port()
        c = FakeContainer(
            phone_id=phone.id,
            name=container_name(phone.id),
            image=default_image or "redroid/redroid:14.0.0_64only-latest (simulated)",
            platform="linux/arm64 (simulated)",
            adb_port=port,
            state="starting",
            started_at=time.time(),
        )
        _containers[phone.id] = c

    log.info("sim.starting", phone=phone.id, adb=port)
    # Flip to running after the fake boot time, in a background thread.
    def _boot():
        time.sleep(BOOT_SECONDS)
        with _lock:
            if _containers.get(phone.id) is c:
                c.state = "running"
                log.info("sim.running", phone=phone.id)

    threading.Thread(target=_boot, daemon=True).start()
    return c


def stop_container(phone_id: str) -> bool:
    with _lock:
        c = _containers.get(phone_id)
        if c is None:
            return False
        c.state = "stopping"

    log.info("sim.stopping", phone=phone_id)
    def _down():
        time.sleep(SHUTDOWN_SECONDS)
        with _lock:
            if _containers.get(phone_id) is c:
                c.state = "exited"
                log.info("sim.stopped", phone=phone_id)

    threading.Thread(target=_down, daemon=True).start()
    return True


def remove_container(phone_id: str, force: bool = True) -> bool:
    with _lock:
        c = _containers.pop(phone_id, None)
    if c is None:
        return False
    log.info("sim.removed", phone=phone_id)
    return True


def container_status(phone_id: str) -> dict | None:
    with _lock:
        c = _containers.get(phone_id)
    if c is None:
        return None
    return {
        "id": "sim-" + c.phone_id[:8],
        "name": c.name,
        "image": c.image,
        "status": c.state,
        "started_at": c.started_at,
        "adb_port": c.adb_port,
    }


def list_managed_containers() -> list[dict]:
    with _lock:
        return [
            {
                "id": "sim-" + c.phone_id[:8],
                "name": c.name,
                "phone_id": c.phone_id,
                "status": c.state,
                "adb_port": c.adb_port,
                "template_id": None,
                "phone_name": c.name,
            }
            for c in _containers.values()
        ]


def map_status_to_phone(state: str | None) -> str:
    if state == "running":
        return "running"
    if state in ("created", "starting"):
        return "starting"
    if state in ("exited", "stopping"):
        return "stopped"
    return "error"
