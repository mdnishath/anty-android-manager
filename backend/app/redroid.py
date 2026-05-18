"""redroid container lifecycle helpers — facade over real Docker and a
simulated runtime. The chosen mode is decided at startup by `runtime.probe_runtime`.

Real path: spins up a redroid container per phone with the right build props,
ADB port forward and resource limits.

Simulated path: in-memory fake containers with realistic timing so the UI
flows still work on Windows hosts without a binder-capable kernel.

Image selection (real mode):
- amd64 host  → `redroid/redroid:<v>_64only-latest`  (native, fast)
- arm64 host  → same multi-arch tag with platform="linux/arm64" via QEMU
"""

from __future__ import annotations

import os
import subprocess
import threading
import time
from dataclasses import dataclass

import structlog

from . import simulated
from .docker_client import docker_client
from .runtime import probe_runtime
from .schemas import PhoneInstance

log = structlog.get_logger(__name__)

# ADB host port pool — each running container gets one.
ADB_PORT_START = 5555
ADB_PORT_END = 5755  # ~200 simultaneous containers
_port_lock = threading.Lock()
_allocations: dict[str, int] = {}  # phone_id → host_port


def _allocate_port(phone_id: str) -> int:
    with _port_lock:
        if phone_id in _allocations:
            return _allocations[phone_id]
        used = set(_allocations.values())
        for port in range(ADB_PORT_START, ADB_PORT_END + 1):
            if port not in used:
                _allocations[phone_id] = port
                return port
        raise RuntimeError("ADB port pool exhausted")


def _release_port(phone_id: str) -> None:
    with _port_lock:
        _allocations.pop(phone_id, None)


def container_name(phone_id: str) -> str:
    return f"cp-{phone_id}"


@dataclass
class ImageChoice:
    image: str
    platform: str | None  # e.g. "linux/arm64" for QEMU emulation


def choose_image(phone: PhoneInstance, default_image: str | None = None) -> ImageChoice:
    """Pick a redroid image. `default_image` is the override from app settings.

    redroid tags are multi-arch (e.g. `14.0.0_64only` has both amd64 and arm64
    manifests). On amd64 hosts we default to the amd64 variant (native, fast)
    even when the phone's claimed ABI is arm64 — QEMU emulation is too slow to
    actually boot Android. Set `CP_FORCE_ARM=1` in the env to force arm64.
    """
    version = phone.templateSnapshot.android.get("version", "14")
    base = {
        "16": "redroid/redroid:16.0.0_64only-latest",
        "15": "redroid/redroid:15.0.0_64only-latest",
        "14": "redroid/redroid:14.0.0_64only-latest",
        "13": "redroid/redroid:13.0.0_64only-latest",
        "12": "redroid/redroid:12.0.0_64only-latest",
        "11": "redroid/redroid:11.0.0_64only-latest",
    }.get(str(version), "redroid/redroid:14.0.0_64only-latest")

    image = default_image or base
    force_arm = os.getenv("CP_FORCE_ARM") == "1"
    if force_arm and phone.abi == "arm64-v8a":
        platform = "linux/arm64"
    else:
        platform = "linux/amd64"
    return ImageChoice(image=image, platform=platform)


def _host_cpu_count() -> int:
    try:
        return max(1, os.cpu_count() or 1)
    except Exception:  # noqa: BLE001
        return 1


def _host_free_ram_gb() -> int:
    """Read /proc/meminfo and return available RAM in GB (best-effort)."""
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    kb = int(line.split()[1])
                    return max(1, kb // 1024 // 1024)
    except Exception:  # noqa: BLE001
        pass
    return 4  # safe default


def build_env(phone: PhoneInstance) -> dict[str, str]:
    """Build props that redroid forwards into `getprop`. Mirrors the fingerprint
    fields the frontend already collects.
    """
    t = phone.templateSnapshot
    b = t.build
    a = t.android
    return {
        "ro.product.brand": str(b.get("productBrand", t.brand)),
        "ro.product.manufacturer": str(b.get("manufacturer", t.brand)),
        "ro.product.model": str(b.get("productModel", t.model)),
        "ro.product.name": str(b.get("productName", "")),
        "ro.product.device": str(b.get("productDevice", "")),
        "ro.serialno": phone.identity.serialNumber,
        "ro.build.fingerprint": str(b.get("fingerprint", "")),
        "ro.build.id": str(a.get("buildId", "")),
        "ro.build.version.release": str(a.get("version", "14")),
        "ro.build.version.sdk": str(a.get("apiLevel", 34)),
        "ro.build.version.security_patch": str(a.get("securityPatch", "")),
        "ro.build.display.id": phone.identity.buildNumber,
        # Network / locale
        "persist.sys.timezone": phone.location.timezone,
        "persist.sys.locale": phone.location.language,
    }


def build_cmd(phone: PhoneInstance) -> list[str]:
    """Cmdline args appended after the image name — redroid reads `androidboot.*`."""
    d = phone.templateSnapshot.display
    return [
        f"androidboot.redroid_width={d.get('widthPx', 1080)}",
        f"androidboot.redroid_height={d.get('heightPx', 1920)}",
        f"androidboot.redroid_dpi={d.get('densityDpi', 420)}",
        "androidboot.use_memfd=1",
        "androidboot.redroid_fps=60",
        # guest = ANGLE software GPU — consistent & faster than pure sw on VPS
        "androidboot.redroid_gpu_mode=guest",
    ]


def build_labels(phone: PhoneInstance) -> dict[str, str]:
    return {
        "cp.phone": phone.id,
        "cp.template": phone.templateId,
        "cp.name": phone.name,
        "cp.brand": phone.templateSnapshot.brand,
    }


def ensure_image(image: str, platform: str | None = None) -> None:
    """Pull image if it isn't already present."""
    client = docker_client.client
    if client is None:
        raise RuntimeError("Docker not available")
    try:
        client.images.get(image)
        return
    except Exception:  # noqa: BLE001
        log.info("redroid.image.pulling", image=image, platform=platform)
        client.images.pull(image, platform=platform)
        log.info("redroid.image.pulled", image=image)


def _use_simulated() -> bool:
    return probe_runtime().mode != "real"


# ─── mac80211_hwsim WiFi injection ───────────────────────────────────────────

_wifi_lock = threading.Lock()
_HWSIM_RADIOS = 8  # pre-create this many virtual radios on first use


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def _host_phys() -> list[str]:
    """List phy names visible in the host network namespace (e.g. ['phy0','phy1']).
    Phys moved into container namespaces won't appear here.
    """
    r = _run(["iw", "phy"])
    phys = []
    for line in r.stdout.splitlines():
        if line.startswith("Wiphy phy"):
            phys.append(line.split()[1])
    return phys


def _ensure_hwsim() -> bool:
    """Load mac80211_hwsim with enough pre-created radios. Idempotent."""
    if os.path.exists("/sys/module/mac80211_hwsim"):
        return True
    r = _run(["modprobe", "mac80211_hwsim", f"radios={_HWSIM_RADIOS}"])
    if r.returncode != 0:
        log.warning("wifi.hwsim.load_failed", stderr=r.stderr.strip())
        return False
    time.sleep(0.5)  # let kernel create the interfaces
    return True


def inject_wifi(cname: str) -> bool:
    """Move a mac80211_hwsim virtual radio into the container so Android's
    WifiService gets a real wlan0 interface. Returns True on success.
    """
    try:
        with _wifi_lock:
            if not _ensure_hwsim():
                return False

            phys = _host_phys()
            if not phys:
                log.warning("wifi.inject.no_free_phy")
                return False
            phy = phys[0]  # take the first free phy

            r = _run(["docker", "inspect", cname, "--format", "{{.State.Pid}}"])
            pid = r.stdout.strip()
            if not pid or pid == "0":
                log.warning("wifi.inject.no_pid", container=cname)
                return False

            # Move the phy into the container's net namespace
            r = _run(["iw", "phy", phy, "set", "netns", pid])
            if r.returncode != 0:
                log.warning("wifi.inject.move_failed", phy=phy, err=r.stderr.strip())
                return False

            time.sleep(0.3)
            # Bring up wlan0 inside the container
            _run(["nsenter", "-t", pid, "-n", "ip", "link", "set", "wlan0", "up"])

            log.info("wifi.inject.ok", container=cname, phy=phy, pid=pid)
            return True
    except Exception as exc:  # noqa: BLE001
        log.warning("wifi.inject.error", error=str(exc))
        return False


def start_container(phone: PhoneInstance, default_image: str | None = None):
    """Idempotent. If a container with this phone's name already exists, return it."""
    if _use_simulated():
        return simulated.start_container(phone, default_image)

    client = docker_client.client
    if client is None:
        raise RuntimeError("Docker not available")

    name = container_name(phone.id)
    existing = _find_container(name)
    if existing is not None:
        if existing.status != "running":
            existing.start()
        return existing

    choice = choose_image(phone, default_image)
    ensure_image(choice.image, choice.platform)

    host_port = _allocate_port(phone.id)
    log.info(
        "redroid.starting",
        phone=phone.id,
        name=name,
        image=choice.image,
        platform=choice.platform,
        adb=host_port,
    )

    # Clamp resource limits to what the host actually has so we don't 400 on
    # `docker create`. RAM is capped to 80% of free RAM; CPUs to host count.
    template_cores = int(phone.templateSnapshot.cpu.get("cores", 4))
    cores = min(template_cores, _host_cpu_count())
    ram_gb = max(1, min(phone.ramGb, _host_free_ram_gb()))

    kwargs: dict = {
        "image": choice.image,
        "name": name,
        "detach": True,
        "privileged": True,
        "tty": True,
        "stdin_open": True,
        "remove": False,
        "labels": build_labels(phone),
        "environment": build_env(phone),
        # No host port mapping — Docker's iptables NAT chain on Ubuntu+nftables
        # rejects `--to-destination`. We expose the container's bridge IP via
        # `container_status()` instead; callers SSH-tunnel `<bridge-ip>:5555`.
        "command": build_cmd(phone),
        "mem_limit": f"{ram_gb}g",
        "nano_cpus": int(cores * 1e9),
        "volumes": {"/dev/binderfs": {"bind": "/dev/binderfs", "mode": "rw"}},
    }
    if choice.platform:
        kwargs["platform"] = choice.platform

    container = client.containers.run(**kwargs)
    log.info("redroid.started", phone=phone.id, id=container.short_id, adb_port=host_port)

    if phone.network.type == "wifi":
        # Give Android a few seconds to start its network stack, then inject
        def _wifi_later():
            time.sleep(8)
            inject_wifi(name)
        threading.Thread(target=_wifi_later, daemon=True).start()

    return container


def stop_container(phone_id: str) -> bool:
    """Returns True if there was a container to stop."""
    if _use_simulated():
        return simulated.stop_container(phone_id)
    container = _find_container(container_name(phone_id))
    if container is None:
        _release_port(phone_id)
        return False
    log.info("redroid.stopping", phone=phone_id, id=container.short_id)
    try:
        container.stop(timeout=10)
    except Exception as exc:  # noqa: BLE001
        log.warning("redroid.stop.error", phone=phone_id, error=str(exc))
    return True


def remove_container(phone_id: str, force: bool = True) -> bool:
    if _use_simulated():
        return simulated.remove_container(phone_id, force)
    container = _find_container(container_name(phone_id))
    if container is None:
        _release_port(phone_id)
        return False
    log.info("redroid.removing", phone=phone_id, id=container.short_id)
    try:
        container.remove(force=force)
    finally:
        _release_port(phone_id)
    return True


def container_status(phone_id: str) -> dict | None:
    if _use_simulated():
        return simulated.container_status(phone_id)
    container = _find_container(container_name(phone_id))
    if container is None:
        return None
    container.reload()
    state = container.attrs.get("State", {})
    networks = container.attrs.get("NetworkSettings", {}).get("Networks", {})
    # Pick the first non-empty IP from any attached network.
    bridge_ip = None
    for net in networks.values():
        ip = net.get("IPAddress")
        if ip:
            bridge_ip = ip
            break
    return {
        "id": container.short_id,
        "name": container.name,
        "image": container.attrs.get("Config", {}).get("Image"),
        "status": state.get("Status"),
        "started_at": state.get("StartedAt"),
        "adb_endpoint": f"{bridge_ip}:5555" if bridge_ip else None,
        "container_ip": bridge_ip,
        "adb_port": 5555,
    }


def list_managed_containers() -> list[dict]:
    """Return all containers we created (filtered by label)."""
    if _use_simulated():
        return simulated.list_managed_containers()
    client = docker_client.client
    if client is None:
        return []
    try:
        containers = client.containers.list(all=True, filters={"label": "cp.phone"})
    except Exception:  # noqa: BLE001
        return []
    out = []
    for c in containers:
        labels = c.labels or {}
        phone_id = labels.get("cp.phone")
        out.append(
            {
                "id": c.short_id,
                "name": c.name,
                "phone_id": phone_id,
                "status": c.status,
                "adb_port": _allocations.get(phone_id) if phone_id else None,
                "template_id": labels.get("cp.template"),
                "phone_name": labels.get("cp.name"),
            }
        )
    return out


def _find_container(name: str):
    client = docker_client.client
    if client is None:
        return None
    try:
        return client.containers.get(name)
    except Exception:  # noqa: BLE001
        return None


def map_status_to_phone(docker_status: str | None) -> str:
    """Translate Docker container status → PhoneStatus."""
    if _use_simulated():
        return simulated.map_status_to_phone(docker_status)
    if docker_status in ("running",):
        return "running"
    if docker_status in ("created", "restarting"):
        return "starting"
    if docker_status in ("dead",):
        return "error"
    return "stopped"
