"""redroid container lifecycle helpers — facade over real Docker and a
simulated runtime. The chosen mode is decided at startup by `runtime.probe_runtime`.

Real path: spins up a redroid container per phone with the right build props,
ADB port forward and resource limits.

Simulated path: in-memory fake containers with realistic timing so the UI
flows still work on Windows hosts without a binder-capable kernel.

Image selection (real mode):
- amd64 host  → `redroid/redroid:<v>_64only-latest`  (native, fast)
- arm64 host  → same multi-arch tag with platform="linux/arm64" via QEMU

WiFi mode:
  When phone.network.type == "wifi", inject_wifi() moves a mac80211_hwsim
  virtual radio into the container's network namespace so Android's wificond
  sees a real wlan0 interface. A lightweight wpa_supplicant (running via
  nsenter) connects to a hostapd AP on the host and DHCP assigns an IP.
  iptables MASQUERADE routes the 192.168.88.0/24 WiFi subnet to the host's
  internet. The container's default route is swapped to wlan0 so all traffic
  appears to come from a WiFi interface.

  NOTE: Android's WifiService status bar indicator still shows "Ethernet" in
  the stock redroid image because there is no wpa_supplicant AIDL HAL binary
  in /vendor/bin/hw/. Actual packet flow is over wlan0; the framework display
  is a known limitation of the unmodified redroid build.
"""

from __future__ import annotations

import os
import re
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
        # ANGLE software GPU — consistent on GPU-less VPS
        "androidboot.redroid_gpu_mode=guest",
    ]


def build_labels(phone: PhoneInstance) -> dict[str, str]:
    return {
        "cp.phone": phone.id,
        "cp.template": phone.templateId,
        "cp.name": phone.name,
        "cp.brand": phone.templateSnapshot.brand,
        "cp.network": phone.network.type if phone.network else "cellular",
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
_HWSIM_RADIOS = 16  # pre-create this many virtual radios

# WiFi AP subnet used by hostapd/dnsmasq on the host
_WIFI_SUBNET = "192.168.88"
_WIFI_GATEWAY = f"{_WIFI_SUBNET}.1"
_WIFI_SSID = "CloudPhone"


def _run(cmd: list[str], timeout: int = 10) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def _host_phys() -> list[str]:
    """List phy names visible in the host network namespace, excluding the AP phy."""
    r = _run(["iw", "phy"])
    phys = []
    for line in r.stdout.splitlines():
        if line.startswith("Wiphy phy"):
            phys.append(line.split()[1])
    # phy1 (wlan1) is reserved for the AP — never inject it into a container
    return [p for p in phys if p != "phy1"]


def _ensure_hwsim() -> bool:
    """Load mac80211_hwsim with enough pre-created radios. Idempotent."""
    if os.path.exists("/sys/module/mac80211_hwsim"):
        # Already loaded — count available host-side radios
        phys = _host_phys()
        if len(phys) >= 2:
            return True
        # All radios were moved into containers; add more
        _run(["modprobe", "-r", "mac80211_hwsim"])
        time.sleep(0.5)
    r = _run(["modprobe", "mac80211_hwsim", f"radios={_HWSIM_RADIOS}"])
    if r.returncode != 0:
        log.warning("wifi.hwsim.load_failed", stderr=r.stderr.strip())
        return False
    time.sleep(0.5)
    return True


_AP_IFACE = "wlan1"  # always use wlan1 as the AP (hostapd) radio


def _ensure_hostapd() -> bool:
    """Ensure a hostapd AP (SSID=CloudPhone) is running on wlan1."""
    r = _run(["pgrep", "-f", "hostapd"])
    if r.returncode == 0:
        return True  # already running

    phys = _host_phys()
    if len(phys) < 2:
        log.warning("wifi.hostapd.no_phy", phys=phys)
        return False

    # wlan1 (phy1) = AP; set its IP
    _run(["ip", "link", "set", _AP_IFACE, "up"])
    _run(["ip", "addr", "add", f"{_WIFI_GATEWAY}/24", "dev", _AP_IFACE])

    conf_path = "/etc/cloudphone/hostapd.conf"
    if not os.path.exists(conf_path):
        hostapd_conf = (
            f"interface={_AP_IFACE}\n"
            f"driver=nl80211\n"
            f"ssid={_WIFI_SSID}\n"
            f"hw_mode=g\nchannel=6\nwmm_enabled=0\nauth_algs=1\n"
        )
        with open(conf_path, "w") as f:
            f.write(hostapd_conf)

    r = _run(["hostapd", "-B", conf_path])
    if r.returncode != 0:
        log.warning("wifi.hostapd.failed", stderr=r.stderr.strip())
        return False

    # Also start dnsmasq for DHCP
    dnsmasq_conf = "/etc/cloudphone/dnsmasq-wifi.conf"
    if os.path.exists(dnsmasq_conf):
        _run(["dnsmasq", "--conf-file=" + dnsmasq_conf])

    time.sleep(1)
    log.info("wifi.hostapd.started", iface=_AP_IFACE)
    return True


def _ensure_nat() -> None:
    """Set up iptables MASQUERADE for the WiFi subnet → internet."""
    try:
        _run(["sh", "-c", "echo 1 > /proc/sys/net/ipv4/ip_forward"])
        # Add MASQUERADE if not already present
        check = _run(["iptables", "-t", "nat", "-C", "POSTROUTING",
                       "-s", f"{_WIFI_SUBNET}.0/24", "-j", "MASQUERADE"])
        if check.returncode != 0:
            _run(["iptables", "-t", "nat", "-A", "POSTROUTING",
                  "-s", f"{_WIFI_SUBNET}.0/24", "-j", "MASQUERADE"])
        # Allow forwarding
        check2 = _run(["iptables", "-C", "FORWARD", "-j", "ACCEPT"])
        if check2.returncode != 0:
            _run(["iptables", "-A", "FORWARD", "-j", "ACCEPT"])
    except Exception as exc:  # noqa: BLE001
        log.warning("wifi.nat.error", error=str(exc))


def _find_wlan_in_netns(pid: str) -> str | None:
    """Return the name of the first wlan* interface in the container's netns."""
    r = _run(["nsenter", "-t", pid, "-n", "ip", "-o", "link", "show", "type", "wlan"])
    if r.returncode != 0 or not r.stdout.strip():
        return None
    # Output: "27: wlan7: <...> ..."
    m = re.search(r"\d+:\s+(wlan\d+):", r.stdout)
    return m.group(1) if m else None


def inject_wifi(cname: str) -> bool:
    """Move a mac80211_hwsim virtual radio into the container, rename its
    interface to wlan0, connect wpa_supplicant to the host AP, assign DHCP
    or static IP, and route container traffic through wlan0.

    Returns True on success.
    """
    try:
        with _wifi_lock:
            if not _ensure_hwsim():
                return False

            # Pick a host-side phy that is NOT already in a container netns.
            # phy0 → wlan0 on host; we grab the first available.
            phys = _host_phys()
            if not phys:
                log.warning("wifi.inject.no_free_phy")
                return False
            phy = phys[0]

            r = _run(["docker", "inspect", cname, "--format", "{{.State.Pid}}"])
            pid = r.stdout.strip()
            if not pid or pid == "0":
                log.warning("wifi.inject.no_pid", container=cname)
                return False

            # Move phy into the container's netns
            r = _run(["iw", "phy", phy, "set", "netns", pid])
            if r.returncode != 0:
                log.warning("wifi.inject.move_failed", phy=phy, err=r.stderr.strip())
                return False

            time.sleep(0.3)

            # Find actual interface name created for this phy inside the container
            iface = _find_wlan_in_netns(pid)
            if not iface:
                log.warning("wifi.inject.no_iface", phy=phy)
                return False

            # Rename to wlan0 if needed (phy7 → wlan7, we need wlan0)
            if iface != "wlan0":
                r = _run(["nsenter", "-t", pid, "-n",
                          "ip", "link", "set", iface, "name", "wlan0"])
                if r.returncode != 0:
                    log.warning("wifi.inject.rename_failed", iface=iface, err=r.stderr.strip())
                    return False
                log.info("wifi.inject.renamed", old=iface, new="wlan0")

            # Bring wlan0 up
            _run(["nsenter", "-t", pid, "-n", "ip", "link", "set", "wlan0", "up"])

            log.info("wifi.inject.ok", container=cname, phy=phy, pid=pid)
            return True
    except Exception as exc:  # noqa: BLE001
        log.warning("wifi.inject.error", error=str(exc))
        return False


def _connect_wpa(pid: str) -> bool:
    """Start wpa_supplicant in the container's netns to connect to the host AP."""
    wpa_conf = f"""\
ctrl_interface=/var/run/wpa_supplicant
network={{
    ssid="{_WIFI_SSID}"
    key_mgmt=NONE
}}
"""
    conf_path = f"/tmp/cp_wpa_{pid}.conf"
    with open(conf_path, "w") as f:
        f.write(wpa_conf)

    # Kill any stale wpa_supplicant in this netns
    _run(["nsenter", "-t", pid, "-n",
          "sh", "-c", "kill $(cat /var/run/wpa_supplicant/wlan0.pid 2>/dev/null) 2>/dev/null || true"])

    r = _run([
        "nsenter", "-t", pid, "-n",
        "wpa_supplicant", "-B",
        "-i", "wlan0",
        "-c", conf_path,
        "-D", "nl80211",
        "-P", f"/var/run/wpa_supplicant/wlan0_{pid}.pid",
    ], timeout=15)

    if r.returncode != 0:
        log.warning("wifi.wpa.start_failed", pid=pid, err=r.stderr.strip())
        return False

    # Wait for association
    for _ in range(20):
        time.sleep(0.5)
        sr = _run(["nsenter", "-t", pid, "-n",
                   "sh", "-c",
                   "wpa_cli -i wlan0 status 2>/dev/null | grep wpa_state"])
        if "COMPLETED" in sr.stdout:
            log.info("wifi.wpa.connected", pid=pid)
            return True
    log.warning("wifi.wpa.timeout", pid=pid)
    return False


def _assign_dhcp(pid: str) -> bool:
    """Try udhcpc/dhclient to get IP on wlan0 from the hostapd/dnsmasq."""
    for dhcp_bin in ["udhcpc", "dhclient"]:
        r = _run(["nsenter", "-t", pid, "-n", dhcp_bin, "-i", "wlan0", "-n", "-q"],
                 timeout=10)
        if r.returncode == 0:
            log.info("wifi.dhcp.ok", client=dhcp_bin, pid=pid)
            return True
    # Fall back to static
    static_ip = f"{_WIFI_SUBNET}.{int(pid) % 200 + 10}"
    _run(["nsenter", "-t", pid, "-n", "ip", "addr", "add",
          f"{static_ip}/24", "dev", "wlan0"])
    log.info("wifi.dhcp.static_fallback", ip=static_ip, pid=pid)
    return True


def _route_via_wlan0(pid: str) -> None:
    """Make wlan0 the primary route in Android's policy routing tables.

    Android uses table 1002 as its main network table (populated by netd).
    We replace the eth0 default with wlan0 so all app traffic flows through
    the WiFi path. The `onlink` flag is required because mac80211_hwsim
    interfaces report carrier=0 from the kernel's perspective even when
    associated (a known quirk of cross-netns phy moves).
    """
    gw = _WIFI_GATEWAY
    # Update Android's main routing table (table 1002)
    _run(["nsenter", "-t", pid, "-n",
          "ip", "route", "del", "default", "table", "1002"])
    _run(["nsenter", "-t", pid, "-n",
          "ip", "route", "add", "default",
          "via", gw, "dev", "wlan0", "metric", "10",
          "onlink", "table", "1002"])
    # Add to main table as well for completeness
    _run(["nsenter", "-t", pid, "-n",
          "ip", "route", "add", "default",
          "via", gw, "dev", "wlan0", "metric", "10", "onlink"])
    log.info("wifi.route.wlan0_primary", pid=pid, gw=gw)


def setup_wifi(cname: str) -> None:
    """Full WiFi setup: inject phy → connect wpa → DHCP → route via wlan0."""
    r = _run(["docker", "inspect", cname, "--format", "{{.State.Pid}}"])
    pid = r.stdout.strip()
    if not pid or pid == "0":
        log.warning("wifi.setup.no_pid", container=cname)
        return

    _ensure_nat()

    if not _ensure_hostapd():
        log.warning("wifi.setup.no_hostapd")

    if not inject_wifi(cname):
        log.warning("wifi.setup.inject_failed", container=cname)
        return

    time.sleep(1)

    if _connect_wpa(pid):
        _assign_dhcp(pid)
        _route_via_wlan0(pid)
    else:
        log.warning("wifi.setup.wpa_failed", container=cname)


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
        # No host port mapping — expose container bridge IP via container_status().
        "command": build_cmd(phone),
        "mem_limit": f"{ram_gb}g",
        "nano_cpus": int(cores * 1e9),
        "volumes": {"/dev/binderfs": {"bind": "/dev/binderfs", "mode": "rw"}},
    }
    if choice.platform:
        kwargs["platform"] = choice.platform

    container = client.containers.run(**kwargs)
    log.info("redroid.started", phone=phone.id, id=container.short_id, adb_port=host_port)

    network_type = phone.network.type if phone.network else "cellular"
    if network_type == "wifi":
        # Give Android ~10s to start its network stack before injecting WiFi
        def _wifi_later():
            time.sleep(10)
            setup_wifi(name)
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
                "network_type": labels.get("cp.network"),
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
