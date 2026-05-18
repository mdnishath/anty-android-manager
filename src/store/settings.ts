import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SettingsSnapshot } from '@shared/ipc-schemas';

interface SettingsState {
  settings: SettingsSnapshot;
  hydrated: boolean;
  hydrate: (snap: SettingsSnapshot) => void;
  set: <K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) => Promise<void>;
}

const defaults: SettingsSnapshot = {
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

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      settings: defaults,
      hydrated: false,
      hydrate: (snap) => set({ settings: snap, hydrated: true }),
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

if (typeof window !== 'undefined' && window.cp) {
  void window.cp
    .getAllSettings()
    .then((snap) => useSettingsStore.getState().hydrate(snap))
    .catch(() => {
      /* keep defaults */
    });
  window.cp.onSettingsChanged((snap: SettingsSnapshot) => {
    useSettingsStore.getState().hydrate(snap);
  });
}
