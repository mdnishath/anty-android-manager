import { ipcMain, BrowserWindow, shell, dialog, app } from 'electron';
import log from 'electron-log/main';
import {
  IPC_CHANNELS,
  errorReportSchema,
  openDialogOptsSchema,
  settingsSnapshotSchema,
  type SettingsSnapshot,
} from '../shared/ipc-schemas';
import { sidecar } from './sidecar';
import { getAllSettings, setSetting, onChanged } from './settings-store';
import { launchScrcpy, launchAdbShell, closeTunnel } from './launcher';
import { z } from 'zod';

const launcherInputSchema = z.object({
  phoneId: z.string().min(1),
  phoneName: z.string().default('Phone'),
  containerIp: z.string().min(1),
  sidecarUrl: z.string().min(1),
  sshUser: z.string().optional(),
  networkType: z.enum(['wifi', 'cellular']).optional(),
});

const setSettingArgSchema = z.object({
  key: settingsSnapshotSchema.keyof(),
  value: z.unknown(),
});

const openExternalSchema = z.string().url().refine((u) => u.startsWith('https://') || u.startsWith('http://'), {
  message: 'Only http(s) URLs allowed',
});

const openPathSchema = z.string().min(1);

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.sidecarUrl, () => sidecar.getUrl());
  ipcMain.handle(IPC_CHANNELS.sidecarToken, () => sidecar.getIpcToken());
  ipcMain.handle(IPC_CHANNELS.sidecarState, () => sidecar.getState());

  ipcMain.handle(IPC_CHANNELS.restartSidecar, async () => {
    await sidecar.restart();
  });

  ipcMain.handle(IPC_CHANNELS.restartApp, () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_e, raw: unknown) => {
    const parsed = openExternalSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid URL');
    await shell.openExternal(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.openPath, async (_e, raw: unknown) => {
    const parsed = openPathSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid path');
    await shell.openPath(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.showOpenDialog, async (_e, raw: unknown) => {
    const parsed = openDialogOptsSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new Error('Invalid dialog options');
    const opts = parsed.data;
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: opts.title,
      defaultPath: opts.defaultPath,
      filters: opts.filters,
      properties: opts.properties,
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.getAllSettings, () => getAllSettings());

  ipcMain.handle(IPC_CHANNELS.setSetting, (_e, raw: unknown) => {
    const parsed = setSettingArgSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid setSetting payload');
    const { key, value } = parsed.data;
    const draftCheck = settingsSnapshotSchema.safeParse({ ...getAllSettings(), [key]: value });
    if (!draftCheck.success) throw new Error(`Invalid value for ${String(key)}`);
    setSetting(key, draftCheck.data[key] as SettingsSnapshot[typeof key]);
  });

  ipcMain.handle(IPC_CHANNELS.reportError, (_e, raw: unknown) => {
    const parsed = errorReportSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn('reportError: invalid payload', parsed.error);
      return;
    }
    log.error('Renderer reported error:', parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.winMinimize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.winMaximize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.maximize();
  });

  ipcMain.handle(IPC_CHANNELS.winUnmaximize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.unmaximize();
  });

  ipcMain.handle(IPC_CHANNELS.winClose, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  ipcMain.handle(IPC_CHANNELS.winIsMaximized, (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });

  ipcMain.handle(IPC_CHANNELS.launchScrcpy, async (_e, raw: unknown) => {
    const parsed = launcherInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid launcher input' };
    return launchScrcpy(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.launchAdbShell, async (_e, raw: unknown) => {
    const parsed = launcherInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid launcher input' };
    return launchAdbShell(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.closeTunnel, (_e, raw: unknown) => {
    if (typeof raw === 'string') closeTunnel(raw);
  });

  // Push events to all renderers
  sidecar.on('state', (state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.sidecarStateEvent, state);
    }
  });

  onChanged((snap) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.settingsChangedEvent, snap);
    }
  });
}

export function wireWindowEvents(win: BrowserWindow): void {
  const broadcastMaximized = () => {
    win.webContents.send(IPC_CHANNELS.winMaximizedEvent, win.isMaximized());
  };
  win.on('maximize', broadcastMaximized);
  win.on('unmaximize', broadcastMaximized);
}
