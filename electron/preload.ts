import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  appInfoSchema,
  sidecarStateSchema,
  settingsSnapshotSchema,
  type AppInfo,
  type ErrorReport,
  type OpenDialogOpts,
  type SettingsSnapshot,
  type SidecarState,
} from '../shared/ipc-schemas';

declare const __APP_VERSION__: string;
declare const __COMMIT__: string;

async function buildInitial(): Promise<SettingsSnapshot> {
  const raw = await ipcRenderer.invoke(IPC_CHANNELS.getAllSettings);
  const parsed = settingsSnapshotSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid initial settings from main');
  return parsed.data;
}

const initialSettings = await buildInitial();

const appInfo: AppInfo = appInfoSchema.parse({
  version: __APP_VERSION__,
  commit: __COMMIT__,
  platform: process.platform,
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  node: process.versions.node ?? '',
  initialSettings,
});

const api = {
  app: appInfo,
  async sidecarUrl(): Promise<string> {
    const url = await ipcRenderer.invoke(IPC_CHANNELS.sidecarUrl);
    if (typeof url !== 'string') throw new Error('Invalid sidecar URL');
    return url;
  },
  onSidecarState(cb: (s: SidecarState) => void): () => void {
    const listener = (_e: unknown, raw: unknown) => {
      const parsed = sidecarStateSchema.safeParse(raw);
      if (parsed.success) cb(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.sidecarStateEvent, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sidecarStateEvent, listener);
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
};

contextBridge.exposeInMainWorld('cp', api);

export type CpApi = typeof api;
