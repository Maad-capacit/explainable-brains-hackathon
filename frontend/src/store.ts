import { create } from "zustand";
import { api, type BrainSummary, type PatchMetadata } from "./lib/api";

interface AppState {
  // Data
  brains: BrainSummary[];
  brainsLoading: boolean;
  brainsError: string | null;

  selectedScanName: string | null;
  patches: PatchMetadata[];
  patchesLoading: boolean;
  patchesError: string | null;

  // Interaction
  hoveredPatchIdx: number | null;   // grid <-> scatter sync
  selectedPatchIdx: number | null;  // opens detail modal

  // Actions
  loadBrains: () => Promise<void>;
  selectBrain: (scanName: string) => Promise<void>;
  setHovered: (idx: number | null) => void;
  openDetail: (idx: number) => void;
  closeDetail: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  brains: [],
  brainsLoading: false,
  brainsError: null,

  selectedScanName: null,
  patches: [],
  patchesLoading: false,
  patchesError: null,

  hoveredPatchIdx: null,
  selectedPatchIdx: null,

  async loadBrains() {
    set({ brainsLoading: true, brainsError: null });
    try {
      const brains = await api.brains();
      set({ brains, brainsLoading: false });
      // Auto-select the first brain on initial load
      if (brains.length > 0 && get().selectedScanName === null) {
        await get().selectBrain(brains[0].scan_name);
      }
    } catch (e) {
      set({ brainsError: (e as Error).message, brainsLoading: false });
    }
  },

  async selectBrain(scanName) {
    if (get().selectedScanName === scanName) return;
    set({
      selectedScanName: scanName,
      patches: [],
      patchesLoading: true,
      patchesError: null,
      hoveredPatchIdx: null,
      selectedPatchIdx: null,
    });
    try {
      const patches = await api.patches(scanName);
      // Ignore stale responses if the user switched brains while loading.
      if (get().selectedScanName !== scanName) return;
      set({ patches, patchesLoading: false });
    } catch (e) {
      if (get().selectedScanName !== scanName) return;
      set({ patchesError: (e as Error).message, patchesLoading: false });
    }
  },

  setHovered: (idx) => set({ hoveredPatchIdx: idx }),
  openDetail: (idx) => set({ selectedPatchIdx: idx }),
  closeDetail: () => set({ selectedPatchIdx: null }),
}));
