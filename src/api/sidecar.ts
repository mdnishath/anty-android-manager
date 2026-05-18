/**
 * Frontend client for the Python FastAPI sidecar.
 *
 * Resolves the URL + IPC token via the Electron preload bridge, attaches
 * `X-CP-Token` on every protected call, and surfaces typed responses.
 */

import { getCpSafe } from '@/ipc';

export interface HealthResponse {
  ok: boolean;
  version: string;
  python: string;
  platform: string;
  docker_available: boolean;
  docker_version: string | null;
  runtime_mode: 'real' | 'simulated' | 'unavailable';
  runtime_reason: string;
  binder_available: boolean;
  uptime_seconds: number;
}

let cachedBase: string | null = null;
let cachedToken: string | null = null;

async function resolveConnection(): Promise<{ base: string; token: string } | null> {
  const cp = getCpSafe();
  if (!cp) return null;
  if (cachedBase == null) cachedBase = await cp.sidecarUrl();
  if (cachedToken == null) cachedToken = await cp.sidecarToken();
  return { base: cachedBase, token: cachedToken };
}

/** Force a re-read of the URL/token on next call (after a sidecar restart). */
export function resetSidecarConnection(): void {
  cachedBase = null;
  cachedToken = null;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: unknown;
  /** Skip token (only for /health, /version etc). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export class SidecarError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function sidecarFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const conn = await resolveConnection();
  if (!conn) throw new SidecarError(0, 'Sidecar bridge unavailable', null);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opts.anonymous && conn.token) headers['X-CP-Token'] = conn.token;

  const res = await fetch(`${conn.base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'detail' in parsed
        ? String((parsed as { detail: unknown }).detail)
        : res.statusText || `HTTP ${res.status}`;
    throw new SidecarError(res.status, message, parsed);
  }
  return parsed as T;
}

// ─── Convenience wrappers ──────────────────────────────────────────────

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return sidecarFetch<HealthResponse>('/health', { anonymous: true, signal });
}

export async function fetchVersion() {
  return sidecarFetch<{ app: string; python: string; docker: string | null; platform: string }>(
    '/version',
    { anonymous: true },
  );
}

// ─── Phone lifecycle ──────────────────────────────────────────────────

import type { PhoneInstance } from '@/store/phones';

export interface ActionResponse {
  ok: boolean;
  message?: string;
}

export async function upsertPhone(instance: PhoneInstance): Promise<PhoneInstance> {
  return sidecarFetch<PhoneInstance>('/phones', {
    method: 'POST',
    body: { instance },
  });
}

export async function startPhone(id: string): Promise<ActionResponse> {
  return sidecarFetch<ActionResponse>(`/phones/${id}/start`, { method: 'POST' });
}

export async function stopPhone(id: string): Promise<ActionResponse> {
  return sidecarFetch<ActionResponse>(`/phones/${id}/stop`, { method: 'POST' });
}

export async function deletePhone(id: string): Promise<ActionResponse> {
  return sidecarFetch<ActionResponse>(`/phones/${id}`, { method: 'DELETE' });
}

export async function getPhone(id: string): Promise<PhoneInstance> {
  return sidecarFetch<PhoneInstance>(`/phones/${id}`);
}
