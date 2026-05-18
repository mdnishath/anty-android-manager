"""Runtime configuration for the sidecar.

Reads from environment variables passed by the Electron main process.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Sidecar settings sourced from env."""

    host: str
    port: int
    data_dir: str
    snapshot_dir: str
    apk_dir: str
    log_level: str
    # IPC handshake token — proves the request really came from the Electron
    # main process and not a casual localhost visitor.
    ipc_token: str
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            host=os.getenv("CP_SIDECAR_HOST", "127.0.0.1"),
            port=int(os.getenv("CP_SIDECAR_PORT", "38080")),
            data_dir=os.getenv("CP_DATA_DIR", ""),
            snapshot_dir=os.getenv("CP_SNAPSHOT_DIR", ""),
            apk_dir=os.getenv("CP_APK_DIR", ""),
            log_level=os.getenv("CP_LOG_LEVEL", "info"),
            ipc_token=os.getenv("CP_IPC_TOKEN", ""),
            cors_origins=tuple(
                o.strip() for o in os.getenv("CP_CORS_ORIGINS", "").split(",") if o.strip()
            ),
        )


settings = Settings.from_env()
