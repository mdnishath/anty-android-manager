"""Thin wrapper over docker-py for redroid container management.

Stays lazy — we never crash the sidecar if Docker isn't installed. The
`is_available()` probe is used by `/health` so the frontend can show a clear
status pill ("Docker missing") instead of an opaque 500 later.
"""

from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)


class DockerClient:
    """Lazy Docker SDK wrapper."""

    def __init__(self) -> None:
        self._client = None
        self._version: str | None = None
        self._available: bool | None = None

    def _connect(self) -> None:
        if self._client is not None:
            return
        try:
            import docker  # type: ignore

            self._client = docker.from_env()
            info = self._client.version()
            self._version = info.get("Version")
            self._available = True
            log.info("docker.connected", version=self._version)
        except Exception as exc:  # noqa: BLE001 — broad catch is intentional
            self._client = None
            self._available = False
            log.warning("docker.unavailable", error=str(exc))

    def is_available(self) -> bool:
        if self._available is None:
            self._connect()
        return bool(self._available)

    @property
    def version(self) -> str | None:
        if self._available is None:
            self._connect()
        return self._version

    @property
    def client(self):  # type: ignore[no-untyped-def]
        if self._available is None:
            self._connect()
        return self._client


docker_client = DockerClient()
