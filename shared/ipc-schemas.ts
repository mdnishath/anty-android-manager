import { z } from 'zod';

export const sidecarStateSchema = z.enum(['starting', 'ready', 'exited', 'error']);
export type SidecarState = z.infer<typeof sidecarStateSchema>;

export const settingsSnapshotSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  sidebarCollapsed: z.boolean().default(false),
  density: z.enum(['cozy', 'compact']).default('cozy'),
  sidecarPort: z.number().int().min(1024).max(65535).default(38080),
  defaultDockerImage: z.string().default('redroid/redroid:14.0.0_64only'),
  dataDir: z.string().default(''),
  snapshotDir: z.string().default(''),
  apkDir: z.string().default(''),
  logBufferSize: z.number().int().min(1000).max(100000).default(10000),
  devTools: z.boolean().default(false),
  telemetry: z.boolean().default(false),
  startupAutoStartBackend: z.boolean().default(true),
  confirmDestructive: z.boolean().default(true),
});
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;

export const errorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  route: z.string().optional(),
  appVersion: z.string().optional(),
  sidecarState: sidecarStateSchema.optional(),
  ts: z.number(),
});
export type ErrorReport = z.infer<typeof errorReportSchema>;

export const openDialogOptsSchema = z.object({
  title: z.string().optional(),
  defaultPath: z.string().optional(),
  filters: z
    .array(z.object({ name: z.string(), extensions: z.array(z.string()) }))
    .optional(),
  properties: z
    .array(z.enum(['openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles']))
    .optional(),
});
export type OpenDialogOpts = z.infer<typeof openDialogOptsSchema>;

export const appInfoSchema = z.object({
  version: z.string(),
  commit: z.string(),
  platform: z.enum(['win32', 'darwin', 'linux', 'aix', 'freebsd', 'openbsd', 'sunos']),
  electron: z.string(),
  chrome: z.string(),
  node: z.string(),
});
export type AppInfo = z.infer<typeof appInfoSchema>;

export const IPC_CHANNELS = {
  sidecarUrl: 'cp:sidecar:url',
  sidecarToken: 'cp:sidecar:token',
  sidecarState: 'cp:sidecar:state:get',
  sidecarStateEvent: 'cp:sidecar:state',
  restartSidecar: 'cp:sidecar:restart',
  restartApp: 'cp:app:restart',
  openExternal: 'cp:shell:openExternal',
  openPath: 'cp:shell:openPath',
  showOpenDialog: 'cp:dialog:showOpen',
  getAllSettings: 'cp:settings:getAll',
  setSetting: 'cp:settings:set',
  settingsChangedEvent: 'cp:settings:changed',
  reportError: 'cp:diagnostics:reportError',
  winMinimize: 'cp:win:minimize',
  winMaximize: 'cp:win:maximize',
  winUnmaximize: 'cp:win:unmaximize',
  winClose: 'cp:win:close',
  winIsMaximized: 'cp:win:isMaximized',
  winMaximizedEvent: 'cp:win:maximizedChanged',
} as const;
