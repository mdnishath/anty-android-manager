import { app, BrowserWindow, shell, session } from 'electron';
import { join } from 'node:path';
import log from 'electron-log/main';
import { registerIpcHandlers, wireWindowEvents } from './ipc-handlers';
import { sidecar } from './sidecar';
import { startWslKeepalive, stopWslKeepalive } from './wsl-keepalive';

log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

app.enableSandbox();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 540,
    show: false,
    backgroundColor: '#0F141A',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform === 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  wireWindowEvents(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allow =
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:') ||
      url.startsWith('file://');
    if (!allow) event.preventDefault();
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function applyCSP(): void {
  const isDev = !app.isPackaged;
  // Dev needs 'unsafe-inline' + 'unsafe-eval' for Vite HMR / React Fast Refresh.
  // Prod allows 'unsafe-inline' temporarily so the FOUC theme-bootstrap inline
  // script in index.html runs; TODO replace with a SHA-256 hash at build time.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    // Renderer needs to reach the sidecar (local or remote VPS) for /health,
    // /phones etc. We're a desktop shell so allow http(s) + ws(s) outbound.
    `connect-src 'self' http: https: ws: wss: ${isDev ? 'ws://localhost:* http://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(() => {
  applyCSP();
  registerIpcHandlers();
  sidecar.start();
  startWslKeepalive();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopWslKeepalive();
  sidecar.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopWslKeepalive();
});
