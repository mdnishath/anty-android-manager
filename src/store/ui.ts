import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

export type Density = 'cozy' | 'compact';

interface UiState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;

  density: Density;
  setDensity: (value: Density) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (value: boolean) => void;

  bulkSelection: string[];
  setBulkSelection: (ids: string[]) => void;
  clearBulkSelection: () => void;
}

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

        density: 'cozy',
        setDensity: (value) => set({ density: value }),

        commandPaletteOpen: false,
        setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),

        bulkSelection: [],
        setBulkSelection: (ids) => set({ bulkSelection: ids }),
        clearBulkSelection: () => set({ bulkSelection: [] }),
      }),
      {
        name: 'cp.ui',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          density: state.density,
        }),
      },
    ),
    { name: 'ui' },
  ),
);
