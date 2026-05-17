import type { CpApi } from '../electron/preload';

declare global {
  interface Window {
    cp: CpApi;
  }

  const __APP_VERSION__: string;
  const __COMMIT__: string;
  const __BUILD_DATE__: string;
}

export {};
