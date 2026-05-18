"""Phone CRUD + lifecycle endpoints — now backed by real Docker containers.

The frontend `usePhonesStore` is still the source-of-truth for persistent
phone _config_ (identity, proxy, etc). The sidecar owns _live state_ — the
container handle and its observable status. When the frontend asks to start a
phone it POSTs the full instance; we either find an existing container with
the same name or `docker run` a new one with the right build props.
"""

from __future__ import annotations

import os

import structlog
from fastapi import APIRouter, Depends, HTTPException

from .. import redroid
from ..schemas import (
    ActionResponse,
    CreatePhoneRequest,
    PhoneInstance,
    PhoneListResponse,
)
from ..security import require_token

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/phones", tags=["phones"], dependencies=[Depends(require_token)])

# In-memory phone registry mirroring what the frontend has. Hydrated by the
# frontend on demand via POST /phones for now. Later we'll persist this and
# the frontend will reconcile against it.
_phones: dict[str, PhoneInstance] = {}


def _hydrate_status(phone: PhoneInstance) -> PhoneInstance:
    info = redroid.container_status(phone.id)
    if info:
        phone.status = redroid.map_status_to_phone(info.get("status"))  # type: ignore[assignment]
    return phone


@router.get("", response_model=PhoneListResponse)
async def list_phones() -> PhoneListResponse:
    return PhoneListResponse(phones=[_hydrate_status(p) for p in _phones.values()])


@router.post("", response_model=PhoneInstance)
async def upsert_phone(payload: CreatePhoneRequest) -> PhoneInstance:
    """Idempotent — same id replaces the cached config."""
    instance = payload.instance
    _phones[instance.id] = instance
    log.info("phone.upserted", id=instance.id, name=instance.name)
    return _hydrate_status(instance)


@router.get("/{phone_id}", response_model=PhoneInstance)
async def get_phone(phone_id: str) -> PhoneInstance:
    phone = _phones.get(phone_id)
    if not phone:
        raise HTTPException(404, f"No such phone: {phone_id}")
    return _hydrate_status(phone)


@router.delete("/{phone_id}", response_model=ActionResponse)
async def delete_phone(phone_id: str) -> ActionResponse:
    phone = _phones.pop(phone_id, None)
    redroid.remove_container(phone_id, force=True)
    log.info("phone.deleted", id=phone_id, had_record=phone is not None)
    return ActionResponse(ok=True, message=f"Deleted {phone_id}")


@router.post("/{phone_id}/start", response_model=ActionResponse)
async def start_phone(phone_id: str) -> ActionResponse:
    phone = _phones.get(phone_id)
    if not phone:
        raise HTTPException(404, f"No such phone: {phone_id} — upsert first")
    default_image = os.getenv("CP_REDROID_IMAGE") or None
    try:
        container = redroid.start_container(phone, default_image=default_image)
    except RuntimeError as e:
        log.error("phone.start.runtime", id=phone_id, error=str(e))
        raise HTTPException(503, str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("phone.start.failed", id=phone_id)
        raise HTTPException(500, f"Failed to start: {e}") from e
    phone.status = "starting"
    log.info("phone.started", id=phone_id, container=container.short_id)
    return ActionResponse(ok=True, message=f"Starting {phone.name}")


@router.post("/{phone_id}/stop", response_model=ActionResponse)
async def stop_phone(phone_id: str) -> ActionResponse:
    phone = _phones.get(phone_id)
    if not phone:
        raise HTTPException(404, f"No such phone: {phone_id}")
    redroid.stop_container(phone_id)
    phone.status = "stopped"
    log.info("phone.stopped", id=phone_id)
    return ActionResponse(ok=True, message=f"Stopped {phone.name}")


@router.get("/_/containers")
async def list_managed_containers():
    """Diagnostic — show every CP-managed container Docker knows about."""
    return {"containers": redroid.list_managed_containers()}


@router.get("/{phone_id}/connection")
async def phone_connection(phone_id: str):
    """Return the bridge-network address ADB / scrcpy should target.

    The host running the sidecar reaches the container directly at this IP.
    Remote clients need an SSH tunnel.
    """
    phone = _phones.get(phone_id)
    if not phone:
        raise HTTPException(404, f"No such phone: {phone_id}")
    info = redroid.container_status(phone_id)
    if not info:
        raise HTTPException(409, "Container not running — start the phone first")
    return {
        "phone_id": phone_id,
        "phone_name": phone.name,
        "container_ip": info.get("container_ip"),
        "adb_port": info.get("adb_port", 5555),
        "adb_endpoint": info.get("adb_endpoint"),
    }
