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
import net from 'node:net';
import { URL } from 'node:url';
import log from 'electron-log/main';
import { app, shell } from 'electron';

interface Tunnel {
  process: ChildProcess;
  localPort: number;
  containerIp: string;
  remoteHost: string;
  user: string;
}

const tunnels = new Map<string, Tunnel>();
let nextLocalPort = 15555;

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
  /** Sidecar URL, e.g. http://144.79.218.148:38080 — we tunnel through its host. */
  sidecarUrl: string;
  /** SSH user, defaults to `root`. */
  sshUser?: string;
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
  const args = [
    '-N', // no remote command
    '-T', // no pty
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-L',
    `${localPort}:${input.containerIp}:5555`,
    `${user}@${remoteHost}`,
  ];
  log.info(`[launcher] ssh ${args.join(' ')}`);
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
  const t: Tunnel = { process: proc, localPort, containerIp: input.containerIp, remoteHost, user };
  tunnels.set(input.phoneId, t);
  return t;
}

function adbConnect(adb: string, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    execFile(adb, ['connect', `${host}:${port}`], { windowsHide: true }, () => resolve());
  });
}

// ────────────────────────────── public API ──────────────────────────────

export async function launchScrcpy(input: LaunchInput): Promise<LaunchResult> {
  const scrcpy = resolveBinary(SCRCPY_HINTS);
  const adb = resolveBinary(ADB_HINTS);
  if (!scrcpy) return { ok: false, error: 'scrcpy not found in PATH or known locations' };
  if (!adb) return { ok: false, error: 'adb not found in PATH' };

  try {
    const t = await ensureTunnel(input);
    await adbConnect(adb, '127.0.0.1', t.localPort);

    const args = [
      '-s',
      `127.0.0.1:${t.localPort}`,
      '--window-title',
      input.phoneName || 'Phone',
      '--max-size',
      '900',
    ];
    log.info(`[launcher] ${scrcpy} ${args.join(' ')}`);
    const proc = spawn(scrcpy, args, { detached: true, stdio: 'ignore', windowsHide: false });
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
    await adbConnect(adb, '127.0.0.1', t.localPort);
    // Open a new cmd.exe window running adb shell so the user gets a terminal.
    const cmd =
      process.platform === 'win32'
        ? ['cmd.exe', '/c', 'start', '"' + (input.phoneName || 'ADB') + '"', 'cmd', '/k', `"${adb}" -s 127.0.0.1:${t.localPort} shell`]
        : ['x-terminal-emulator', '-e', `${adb} -s 127.0.0.1:${t.localPort} shell`];
    spawn(cmd[0]!, cmd.slice(1), { detached: true, stdio: 'ignore', shell: false }).unref();
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
