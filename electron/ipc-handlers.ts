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
import { z } from 'zod';

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
