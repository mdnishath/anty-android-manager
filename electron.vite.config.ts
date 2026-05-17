import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string };

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* not a git repo or git not available */
}

const buildDate = new Date().toISOString();

const defines = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __COMMIT__: JSON.stringify(commit),
  __BUILD_DATE__: JSON.stringify(buildDate),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: defines,
    build: {
      outDir: 'dist-electron',
      lib: { entry: resolve(__dirname, 'electron/main.ts') },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: defines,
    build: {
      outDir: 'dist-electron',
      lib: { entry: resolve(__dirname, 'electron/preload.ts') },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname),
    plugins: [react()],
    define: defines,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    server: {
      port: 5173,
    },
  },
});
