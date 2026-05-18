import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  sidecarStateSchema,
  settingsSnapshotSchema,
  type ErrorReport,
  type LauncherInput,
  type LauncherResult,
  type OpenDialogOpts,
  type SettingsSnapshot,
  type SidecarState,
} from '../shared/ipc-schemas';

declare const __APP_VERSION__: string;
declare const __COMMIT__: string;

const appInfo = {
  version: __APP_VERSION__,
  commit: __COMMIT__,
  platform: process.platform,
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  node: process.versions.node ?? '',
};

const api = {
  app: appInfo,
  async sidecarUrl(): Promise<string> {
    const url = await ipcRenderer.invoke(IPC_CHANNELS.sidecarUrl);
    if (typeof url !== 'string') throw new Error('Invalid sidecar URL');
    return url;
  },
  async sidecarState(): Promise<SidecarState> {
    const raw = await ipcRenderer.invoke(IPC_CHANNELS.sidecarState);
    const parsed = sidecarStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : 'starting';
  },
  onSidecarState(cb: (s: SidecarState) => void): () => void {
    const listener = (_e: unknown, raw: unknown) => {
      const parsed = sidecarStateSchema.safeParse(raw);
      if (parsed.success) cb(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.sidecarStateEvent, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sidecarStateEvent, listener);
  },
  async sidecarToken(): Promise<string> {
    const token = await ipcRenderer.invoke(IPC_CHANNELS.sidecarToken);
    return typeof token === 'string' ? token : '';
  },
  async restartSidecar(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.restartSidecar);
  },
  async restartApp(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.restartApp);
  },
  async openExternal(url: string): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.openExternal, url);
  },
  async openPath(path: string): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.openPath, path);
  },
  async showOpenDialog(opts: OpenDialogOpts = {}): Promise<string[]> {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.showOpenDialog, opts);
    if (!Array.isArray(result)) return [];
    return result.filter((x): x is string => typeof x === 'string');
  },
  async getAllSettings(): Promise<SettingsSnapshot> {
    const raw = await ipcRenderer.invoke(IPC_CHANNELS.getAllSettings);
    return settingsSnapshotSchema.parse(raw);
  },
  async setSetting<K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.setSetting, { key, value });
  },
  onSettingsChanged(cb: (snap: SettingsSnapshot) => void): () => void {
    const listener = (_e: unknown, raw: unknown) => {
      const parsed = settingsSnapshotSchema.safeParse(raw);
      if (parsed.success) cb(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.settingsChangedEvent, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.settingsChangedEvent, listener);
  },
  async reportError(payload: ErrorReport): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.reportError, payload);
  },
  async winMinimize(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.winMinimize);
  },
  async winMaximize(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.winMaximize);
  },
  async winUnmaximize(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.winUnmaximize);
  },
  async winClose(): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.winClose);
  },
  async winIsMaximized(): Promise<boolean> {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.winIsMaximized);
    return typeof result === 'boolean' ? result : false;
  },
  async launchScrcpy(input: LauncherInput): Promise<LauncherResult> {
    const res = await ipcRenderer.invoke(IPC_CHANNELS.launchScrcpy, input);
    return (res as LauncherResult) ?? { ok: false, error: 'no response' };
  },
  async launchAdbShell(input: LauncherInput): Promise<LauncherResult> {
    const res = await ipcRenderer.invoke(IPC_CHANNELS.launchAdbShell, input);
    return (res as LauncherResult) ?? { ok: false, error: 'no response' };
  },
  async closeTunnel(phoneId: string): Promise<void> {
    await ipcRenderer.invoke(IPC_CHANNELS.closeTunnel, phoneId);
  },
  onMaximizedChanged(cb: (maximized: boolean) => void): () => void {
    const listener = (_e: unknown, raw: unknown) => {
      if (typeof raw === 'boolean') cb(raw);
    };
    ipcRenderer.on(IPC_CHANNELS.winMaximizedEvent, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.winMaximizedEvent, listener);
  },
};

contextBridge.exposeInMainWorld('cp', api);

export type CpApi = typeof api;
