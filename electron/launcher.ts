/**
 * Launches scrcpy + ADB shell windows for a running phone container.
 *
 * Pipeline (when the sidecar is on a remote VPS):
 *   1. parse `ssh user@host` from the sidecar URL
 *   2. allocate a local TCP port
 *   3. spawn `ssh -L localPort:containerIp:5555 user@host -N` in the background
 *   4. wait for the local port to start listening (polling)
 *   5. `adb connect 127.0.0.1:localPort`
 *   6. spawn scrcpy or open a cmd.exe terminal with `adb shell`
 *
 * Tunnels are reused per phone, kept alive until the app quits.
 */

import { spawn, type ChildProcess, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { URL } from 'node:url';
import log from 'electron-log/main';
import { app, shell } from 'electron';

interface Tunnel {
  process: ChildProcess;
  localPort: number;
  /** Per-phone ADB server port — isolates scrcpy/adb sessions across phones. */
  adbServerPort: number;
  containerIp: string;
  remoteHost: string;
  user: string;
}

const tunnels = new Map<string, Tunnel>();
let nextLocalPort = 15555;
let nextAdbServerPort = 5050; // 5037 is the default adb server port — start above it

/** Where to look for scrcpy.exe / adb.exe on Windows. */
const SCRCPY_HINTS = [
  'scrcpy',
  'C:\\Program Files\\scrcpy\\scrcpy.exe',
  'C:\\Users\\nisha\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\\scrcpy-win64-v3.3.4\\scrcpy.exe',
];
const ADB_HINTS = [
  'adb',
  'C:\\Program Files\\platform-tools\\adb.exe',
];

export interface LaunchInput {
  phoneId: string;
  phoneName: string;
  containerIp: string;
  /** Sidecar URL, e.g. http://51.159.152.233:38080 — we tunnel through its host. */
  sidecarUrl: string;
  /** SSH user, defaults to `root`. */
  sshUser?: string;
  /** Network type to emulate inside the container after ADB connects. */
  networkType?: 'wifi' | 'cellular';
}

export interface LaunchResult {
  ok: boolean;
  localPort?: number;
  error?: string;
}

// ────────────────────────────── helpers ──────────────────────────────

function resolveBinary(hints: string[]): string | null {
  for (const h of hints) {
    if (!h.includes('\\') && !h.includes('/')) return h; // bare name — let PATH find it
    if (existsSync(h)) return h;
  }
  return null;
}

function pickPort(): number {
  return nextLocalPort++;
}

function pickAdbServerPort(): number {
  return nextAdbServerPort++;
}

/** Env for adb / scrcpy calls so each phone uses its own dedicated adb server. */
function adbEnv(adbServerPort: number): NodeJS.ProcessEnv {
  return { ...process.env, ANDROID_ADB_SERVER_PORT: String(adbServerPort) };
}

async function waitForListening(port: number, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.createConnection({ host: '127.0.0.1', port });
      s.once('connect', () => {
        s.destroy();
        resolve(true);
      });
      s.once('error', () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function sidecarHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

async function ensureTunnel(input: LaunchInput): Promise<Tunnel> {
  const existing = tunnels.get(input.phoneId);
  if (existing && !existing.process.killed) return existing;

  const remoteHost = sidecarHost(input.sidecarUrl);
  if (!remoteHost) throw new Error(`Cannot parse sidecar URL: ${input.sidecarUrl}`);
  if (isLocalHost(remoteHost)) {
    throw new Error(
      'Local sidecar viewers are not implemented yet — the container bridge IP is unreachable from Windows.',
    );
  }
  const user = input.sshUser ?? 'root';
  const localPort = pickPort();
  const adbServerPort = pickAdbServerPort();

  // Pick the best available SSH identity key (prefer ed25519, fallback to rsa)
  const sshDir = join(homedir(), '.ssh');
  const identityArgs: string[] = [];
  for (const keyFile of ['id_ed25519', 'id_rsa']) {
    const p = join(sshDir, keyFile);
    if (existsSync(p)) { identityArgs.push('-i', p); break; }
  }

  const args = [
    '-N', // no remote command
    '-T', // no pty
    ...identityArgs,
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=NUL',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-L',
    `${localPort}:${input.containerIp}:5555`,
    `${user}@${remoteHost}`,
  ];
  log.info(`[launcher] ssh ${args.join(' ')} (adbServerPort=${adbServerPort})`);
  const proc = spawn('ssh', args, { windowsHide: true, stdio: 'ignore' });
  proc.on('exit', (code) => {
    log.info(`[launcher] tunnel for ${input.phoneId} exited code=${code}`);
    tunnels.delete(input.phoneId);
  });
  // Give ssh a moment, then probe the local port.
  const up = await waitForListening(localPort, 10_000);
  if (!up) {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
    throw new Error(`SSH tunnel to ${remoteHost} did not come up within 10s`);
  }
  const t: Tunnel = {
    process: proc,
    localPort,
    adbServerPort,
    containerIp: input.containerIp,
    remoteHost,
    user,
  };
  tunnels.set(input.phoneId, t);
  return t;
}

function adbConnect(
  adb: string,
  host: string,
  port: number,
  adbServerPort: number,
): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      adb,
      ['connect', `${host}:${port}`],
      { windowsHide: true, env: adbEnv(adbServerPort) },
      () => resolve(),
    );
  });
}

function adbShell(
  adb: string,
  serial: string,
  adbServerPort: number,
  cmd: string,
): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      adb,
      ['-s', serial, 'shell', cmd],
      { windowsHide: true, env: adbEnv(adbServerPort), timeout: 8000 },
      () => resolve(),
    );
  });
}

async function setupNetworkType(
  adb: string,
  serial: string,
  adbServerPort: number,
  networkType: 'wifi' | 'cellular',
): Promise<void> {
  if (networkType === 'wifi') {
    // Rename eth0 → wlan0 so Android's ConnectivityService classifies it as WiFi
    await adbShell(adb, serial, adbServerPort,
      'ip link set eth0 down 2>/dev/null; ' +
      'ip link set eth0 name wlan0 2>/dev/null; ' +
      'ip link set wlan0 up 2>/dev/null; ' +
      'ip route add default via $(ip route show | awk \'/default/{print $3;exit}\') dev wlan0 2>/dev/null; ' +
      'true'
    );
    await adbShell(adb, serial, adbServerPort, 'setprop wifi.interface wlan0');
    await adbShell(adb, serial, adbServerPort, 'setprop wlan.driver.status ok');
    log.info('[launcher] network type → wifi (eth0 renamed to wlan0)');
  } else if (networkType === 'cellular') {
    await adbShell(adb, serial, adbServerPort, 'setprop gsm.network.type LTE');
    await adbShell(adb, serial, adbServerPort, 'setprop gsm.operator.alpha "Mobile"');
    await adbShell(adb, serial, adbServerPort, 'setprop gsm.sim.operator.alpha "Mobile"');
    log.info('[launcher] network type → cellular (props set)');
  }
}

// ────────────────────────────── public API ──────────────────────────────

export async function launchScrcpy(input: LaunchInput): Promise<LaunchResult> {
  const scrcpy = resolveBinary(SCRCPY_HINTS);
  const adb = resolveBinary(ADB_HINTS);
  if (!scrcpy) return { ok: false, error: 'scrcpy not found in PATH or known locations' };
  if (!adb) return { ok: false, error: 'adb not found in PATH' };

  try {
    const t = await ensureTunnel(input);
    await adbConnect(adb, '127.0.0.1', t.localPort, t.adbServerPort);
    if (input.networkType) {
      await setupNetworkType(adb, `127.0.0.1:${t.localPort}`, t.adbServerPort, input.networkType);
    }

    const args = [
      '-s',
      `127.0.0.1:${t.localPort}`,
      '--window-title',
      input.phoneName || 'Phone',
      '--max-size',
      '900',
    ];
    log.info(
      `[launcher] ${scrcpy} ${args.join(' ')} (ANDROID_ADB_SERVER_PORT=${t.adbServerPort})`,
    );
    const proc = spawn(scrcpy, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      env: adbEnv(t.adbServerPort),
    });
    proc.unref();
    return { ok: true, localPort: t.localPort };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('[launcher] scrcpy failed', msg);
    return { ok: false, error: msg };
  }
}

export async function launchAdbShell(input: LaunchInput): Promise<LaunchResult> {
  const adb = resolveBinary(ADB_HINTS);
  if (!adb) return { ok: false, error: 'adb not found in PATH' };
  try {
    const t = await ensureTunnel(input);
    await adbConnect(adb, '127.0.0.1', t.localPort, t.adbServerPort);
    if (input.networkType) {
      await setupNetworkType(adb, `127.0.0.1:${t.localPort}`, t.adbServerPort, input.networkType);
    }
    // Open a new cmd.exe window running adb shell so the user gets a terminal.
    // Setting ANDROID_ADB_SERVER_PORT in the window keeps it isolated from
    // other phones' adb sessions.
    if (process.platform === 'win32') {
      const inner = `set ANDROID_ADB_SERVER_PORT=${t.adbServerPort} && "${adb}" -s 127.0.0.1:${t.localPort} shell`;
      spawn('cmd.exe', ['/c', 'start', `"${input.phoneName || 'ADB'}"`, 'cmd', '/k', inner], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      }).unref();
    } else {
      spawn(
        'x-terminal-emulator',
        ['-e', `${adb} -s 127.0.0.1:${t.localPort} shell`],
        { detached: true, stdio: 'ignore', shell: false, env: adbEnv(t.adbServerPort) },
      ).unref();
    }
    return { ok: true, localPort: t.localPort };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('[launcher] adb shell failed', msg);
    return { ok: false, error: msg };
  }
}

/** Stop a tunnel (e.g. when phone is stopped). */
export function closeTunnel(phoneId: string): void {
  const t = tunnels.get(phoneId);
  if (!t) return;
  // Best-effort: kill the per-phone adb server so it doesn't linger.
  const adb = resolveBinary(ADB_HINTS);
  if (adb) {
    try {
      execFile(adb, ['kill-server'], { windowsHide: true, env: adbEnv(t.adbServerPort) }, () => {
        /* ignore result */
      });
    } catch {
      /* ignore */
    }
  }
  try {
    t.process.kill();
  } catch {
    /* ignore */
  }
  tunnels.delete(phoneId);
}

export function closeAllTunnels(): void {
  for (const id of Array.from(tunnels.keys())) closeTunnel(id);
}

app.on('before-quit', () => {
  closeAllTunnels();
});

// Make TS happy about the unused `shell` import — kept for future browser-open helpers.
void shell;
