"""Pydantic schemas shared by the API. These mirror the frontend types in
`src/store/phones.ts` and `src/lib/proxy.ts`. Keep them in sync.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    ok: bool = True
    version: str
    python: str
    platform: str
    docker_available: bool
    docker_version: str | None = None
    runtime_mode: Literal["real", "simulated", "unavailable"]
    runtime_reason: str
    binder_available: bool
    uptime_seconds: float


class VersionResponse(BaseModel):
    app: str
    python: str
    docker: str | None
    platform: str


# ─── Phone schemas ─────────────────────────────────────────────────────────

PhoneStatus = Literal["stopped", "starting", "running", "error"]
NetworkType = Literal["wifi", "cellular"]
LocationMode = Literal["ip-based", "custom"]
ProxyProtocol = Literal["http", "https", "socks5"]


class PhoneIdentity(BaseModel):
    imei: str
    imsi: str
    androidId: str
    serialNumber: str
    macWifi: str
    macBluetooth: str
    macEthernet: str
    buildNumber: str


class PhoneNetwork(BaseModel):
    type: NetworkType
    phoneNumberMode: Literal["auto", "custom"]
    phoneNumber: str
    country: str
    carrier: str


class PhoneLocation(BaseModel):
    mode: LocationMode
    lat: float | None = None
    lng: float | None = None
    timezone: str
    language: str


class ProxyConfig(BaseModel):
    enabled: bool
    protocol: ProxyProtocol
    host: str
    port: int
    username: str | None = None
    password: str | None = None
    raw: str | None = None


class PhoneTemplate(BaseModel):
    """Subset of the frontend `PhoneTemplate` we need on the backend to render
    redroid build props. Frontend always sends a full snapshot.
    """

    id: str
    brand: str
    model: str
    releaseYear: int
    formFactor: Literal["phone", "foldable", "tablet"]
    ramGb: int
    storageGb: int
    soc: str
    android: dict
    build: dict
    display: dict
    cpu: dict
    gpu: str = ""
    battery: dict | None = None
    tags: list[str] = Field(default_factory=list)
    brandColor: str = "#000000"


class PhoneInstance(BaseModel):
    id: str
    name: str
    templateId: str
    templateSnapshot: PhoneTemplate
    ramGb: int
    storageGb: int
    abi: Literal["arm64-v8a"] = "arm64-v8a"
    identity: PhoneIdentity
    network: PhoneNetwork
    location: PhoneLocation
    proxy: ProxyConfig
    tags: list[str] = Field(default_factory=list)
    folder: str = "Default"
    notes: str = ""
    status: PhoneStatus = "stopped"
    createdAt: int


class CreatePhoneRequest(BaseModel):
    instance: PhoneInstance


class PhoneListResponse(BaseModel):
    phones: list[PhoneInstance]


class ActionResponse(BaseModel):
    ok: bool = True
    message: str | None = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error: str
