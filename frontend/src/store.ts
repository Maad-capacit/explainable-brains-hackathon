import { create } from "zustand";
import { api, type BrainSummary, type PatchMetadata, type ProjectionPoint } from "./lib/api";

interface AppState {
  // Data
  brains: BrainSummary[];
  brainsLoading: boolean;
  brainsError: string | null;

  selectedScanName: string | null;
  patches: PatchMetadata[];
  patchesLoading: boolean;
  patchesError: string | null;

  projection: ProjectionPoint[];
  projectionLoading: boolean;
  projectionError: string | null;

  // Interaction
  hoveredPatchIdx: number | null;   // grid <-> scatter sync
  selectedPatchIdx: number | null;  // opens detail modal
  hoveredProjectionPoint: ProjectionPoint | null;  // UMAP hover → preview overlay

  // Cross-panel imperative bridge: PatchGrid registers a scroll callback on mount,
  // CoordScatter calls it when the user hovers a scatter point.
  scrollToPatchIdx: ((idx: number) => void) | null;

  // Actions
  loadBrains: () => Promise<void>;
  loadProjection: () => Promise<void>;
  selectBrain: (scanName: string) => Promise<void>;
  setHovered: (idx: number | null) => void;
  setHoveredProjectionPoint: (p: ProjectionPoint | null) => void;
  openDetail: (idx: number) => void;
  closeDetail: () => void;
  setScrollToPatchIdx: (fn: ((idx: number) => void) | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  brains: [],
  brainsLoading: false,
  brainsError: null,

  selectedScanName: null,
  patches: [],
  patchesLoading: false,
  patchesError: null,

  projection: [],
  projectionLoading: false,
  projectionError: null,

  hoveredPatchIdx: null,
  selectedPatchIdx: null,
  hoveredProjectionPoint: null,
  scrollToPatchIdx: null,

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

  async loadProjection() {
    if (get().projection.length > 0 || get().projectionLoading) return;
    set({ projectionLoading: true, projectionError: null });
    try {
      const projection = await api.projection();
      set({ projection, projectionLoading: false });
    } catch (e) {
      set({ projectionError: (e as Error).message, projectionLoading: false });
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
  setHoveredProjectionPoint: (p) => set({ hoveredProjectionPoint: p }),
  openDetail: (idx) => set({ selectedPatchIdx: idx }),
  closeDetail: () => set({ selectedPatchIdx: null }),
  setScrollToPatchIdx: (fn) => set({ scrollToPatchIdx: fn }),
}));
