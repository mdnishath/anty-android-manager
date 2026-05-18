import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import log from 'electron-log/main';
import { app } from 'electron';
import { getAllSettings } from './settings-store';
import type { SidecarState } from '../shared/ipc-schemas';

/**
 * Manages the Python FastAPI sidecar.
 *
 * - Picks a free port (uses configured port when available).
 * - Spawns `python -m uvicorn` with env carrying paths + ipc token.
 * - Watches stdout for the `CP_SIDECAR_READY` line to flip state → ready.
 * - Pipes child stdio into electron-log.
 * - Restart-able via the IPC `restartSidecar` channel.
 */
class SidecarManager extends EventEmitter {
  private state: SidecarState = 'starting';
  private port = 38080;
  private process: ChildProcess | null = null;
  private ipcToken = '';
  private stopRequested = false;

  getState(): SidecarState {
    return this.state;
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  getIpcToken(): string {
    return this.ipcToken;
  }

  private setState(next: SidecarState): void {
    if (this.state === next) return;
    this.state = next;
    log.info(`[sidecar] state → ${next}`);
    this.emit('state', next);
  }

  async start(): Promise<void> {
    if (this.process) {
      log.warn('[sidecar] already running, skipping start');
      return;
    }
    this.stopRequested = false;
    this.setState('starting');

    try {
      const settings = getAllSettings();
      this.port = await pickPort(settings.sidecarPort);
      this.ipcToken = randomBytes(24).toString('hex');

      const projectRoot = resolve(__dirname, '..', '..');
      const backendDir = join(projectRoot, 'backend');
      const python = resolvePython(backendDir);

      if (!existsSync(backendDir)) {
        log.error('[sidecar] backend/ directory not found at', backendDir);
        this.setState('error');
        return;
      }

      const args = [
        '-m',
        'uvicorn',
        'app.main:app',
        '--host',
        '127.0.0.1',
        '--port',
        String(this.port),
        '--log-level',
        'warning', // FastAPI app does its own structured logging
      ];

      log.info(`[sidecar] spawn: ${python} ${args.join(' ')} (cwd=${backendDir})`);

      this.process = spawn(python, args, {
        cwd: backendDir,
        env: {
          ...process.env,
          // Make sure Docker Desktop's helpers (docker-credential-desktop etc)
          // are reachable from the child — docker-py needs them on Windows.
          PATH: dockerAugmentedPath(process.env.PATH ?? ''),
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',
          CP_SIDECAR_HOST: '127.0.0.1',
          CP_SIDECAR_PORT: String(this.port),
          CP_DATA_DIR: settings.dataDir,
          CP_SNAPSHOT_DIR: settings.snapshotDir,
          CP_APK_DIR: settings.apkDir,
          CP_LOG_LEVEL: app.isPackaged ? 'info' : 'debug',
          CP_IPC_TOKEN: this.ipcToken,
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim()) continue;
          log.info('[sidecar:out]', line);
          if (line.startsWith('CP_SIDECAR_READY')) {
            this.setState('ready');
          }
        }
      });

      this.process.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim()) continue;
          log.warn('[sidecar:err]', line);
        }
      });

      this.process.on('error', (err) => {
        log.error('[sidecar] spawn error', err);
        this.setState('error');
        this.process = null;
      });

      this.process.on('exit', (code, signal) => {
        log.info(`[sidecar] exit code=${code} signal=${signal}`);
        this.process = null;
        if (this.stopRequested) {
          this.setState('exited');
        } else {
          this.setState(code === 0 ? 'exited' : 'error');
        }
      });
    } catch (err) {
      log.error('[sidecar] start failed', err);
      this.setState('error');
    }
  }

  async restart(): Promise<void> {
    log.info('[sidecar] restart requested');
    await this.stop();
    await this.start();
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.setState('exited');
      return;
    }
    this.stopRequested = true;
    const child = this.process;
    await new Promise<void>((resolveStop) => {
      const onExit = () => resolveStop();
      child.once('exit', onExit);
      try {
        if (process.platform === 'win32') {
          // Graceful kill via taskkill /T (kills the tree, including uvicorn workers)
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
        } else {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (this.process === child) child.kill('SIGKILL');
          }, 3000);
        }
      } catch (err) {
        log.error('[sidecar] kill error', err);
        resolveStop();
      }
      // Safety timeout — don't block app shutdown forever.
      setTimeout(() => resolveStop(), 5000);
    });
    this.process = null;
  }
}

// ─────────────────────── Helpers ───────────────────────

/**
 * Prepend Docker Desktop's CLI bin (and a couple of common alternatives) to
 * PATH so the sidecar's docker-py can spawn credential helpers.
 */
function dockerAugmentedPath(currentPath: string): string {
  if (process.platform !== 'win32') return currentPath;
  const candidates = [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin',
    'C:\\Program Files\\Docker\\Docker\\bin',
  ].filter(existsSync);
  if (candidates.length === 0) return currentPath;
  const sep = ';';
  const parts = currentPath.split(sep);
  for (const c of candidates) if (!parts.includes(c)) parts.unshift(c);
  return parts.join(sep);
}

function resolvePython(backendDir: string): string {
  // Explicit override wins.
  if (process.env['CP_PYTHON']) return process.env['CP_PYTHON']!;
  // Prefer the bundled venv if dev did `python -m venv .venv` in backend/.
  const venvPy =
    process.platform === 'win32'
      ? join(backendDir, '.venv', 'Scripts', 'python.exe')
      : join(backendDir, '.venv', 'bin', 'python');
  if (existsSync(venvPy)) return venvPy;
  // Fall back to system python.
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Try the preferred port first, fall back to an OS-assigned free port.
 */
async function pickPort(preferred: number): Promise<number> {
  if (await isPortFree(preferred)) return preferred;
  return new Promise<number>((res, rej) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => res(port));
    });
  });
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', () => res(false));
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => res(true));
    });
  });
}

export const sidecar = new SidecarManager();
