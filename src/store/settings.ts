import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SettingsSnapshot } from '@shared/ipc-schemas';

interface SettingsState {
  settings: SettingsSnapshot;
  hydrate: (snap: SettingsSnapshot) => void;
  set: <K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) => Promise<void>;
}

function readInitial(): SettingsSnapshot {
  const fromBridge = window.cp?.app?.initialSettings;
  if (fromBridge) return fromBridge;
  return {
    theme: 'dark',
    sidebarCollapsed: false,
    density: 'cozy',
    sidecarPort: 38080,
    defaultDockerImage: 'redroid/redroid:14.0.0_64only',
    dataDir: '',
    snapshotDir: '',
    apkDir: '',
    logBufferSize: 10000,
    devTools: false,
    telemetry: false,
    startupAutoStartBackend: true,
    confirmDestructive: true,
  };
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      settings: readInitial(),
      hydrate: (snap) => set({ settings: snap }),
      set: async (key, value) => {
        const previous = get().settings;
        set({ settings: { ...previous, [key]: value } });
        try {
          await window.cp?.setSetting(key, value);
        } catch (error) {
          set({ settings: previous });
          throw error;
        }
      },
    }),
    { name: 'settings' },
  ),
);

if (typeof window !== 'undefined' && window.cp?.onSettingsChanged) {
  window.cp.onSettingsChanged((snap: SettingsSnapshot) => {
    useSettingsStore.getState().hydrate(snap);
  });
}
