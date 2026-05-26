import { create } from "zustand";
import { api, type BrainSummary, type PatchMetadata, type ProjectionPoint } from "./lib/api";
import {
  ALGORITHMS,
  defaultParams,
  runClustering,
  type AlgoKey,
  type ClusteringResult,
  type ParamValues,
} from "./lib/clustering";

export type Phase = 1 | 2 | 3;

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

  // Per-brain validation phases
  currentPhase: Phase;
  algoKey: AlgoKey;
  algoParams: ParamValues;
  clusterResult: ClusteringResult | null;     // scoped to selectedScanName; cleared on brain change
  clusteringInProgress: boolean;
  clusteringError: string | null;
  selectedCluster: number | null;             // Phase 2: which cluster sub-folder is open

  // Interaction
  hoveredPatchIdx: number | null;
  selectedPatchIdx: number | null;
  hoveredProjectionPoint: ProjectionPoint | null;

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

  // Phase + clustering actions
  setPhase: (phase: Phase) => void;
  setAlgorithm: (key: AlgoKey) => void;
  setAlgoParam: (key: string, value: number | string) => void;
  resetAlgoParams: () => void;
  runClusteringForSelected: () => Promise<void>;
  setSelectedCluster: (clusterId: number | null) => void;
  clearClusterResult: () => void;
}

const INITIAL_ALGO: AlgoKey = "kmeans";

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

  currentPhase: 1,
  algoKey: INITIAL_ALGO,
  algoParams: defaultParams(INITIAL_ALGO),
  clusterResult: null,
  clusteringInProgress: false,
  clusteringError: null,
  selectedCluster: null,

  hoveredPatchIdx: null,
  selectedPatchIdx: null,
  hoveredProjectionPoint: null,
  scrollToPatchIdx: null,

  async loadBrains() {
    set({ brainsLoading: true, brainsError: null });
    try {
      const brains = await api.brains();
      set({ brains, brainsLoading: false });
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
    // Switching brains invalidates the cluster result.
    set({
      selectedScanName: scanName,
      patches: [],
      patchesLoading: true,
      patchesError: null,
      hoveredPatchIdx: null,
      selectedPatchIdx: null,
      clusterResult: null,
      clusteringError: null,
      selectedCluster: null,
      currentPhase: 1,
    });
    try {
      const patches = await api.patches(scanName);
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

  // ── Phase + clustering ─────────────────────────────────────────────────────
  setPhase: (phase) => set({ currentPhase: phase }),

  setAlgorithm: (key) => {
    if (get().algoKey === key) return;
    set({ algoKey: key, algoParams: defaultParams(key) });
  },

  setAlgoParam: (key, value) =>
    set((s) => ({ algoParams: { ...s.algoParams, [key]: value } })),

  resetAlgoParams: () =>
    set((s) => ({ algoParams: defaultParams(s.algoKey) })),

  async runClusteringForSelected() {
    const { selectedScanName, algoKey, algoParams } = get();
    if (!selectedScanName) return;
    if (!(algoKey in ALGORITHMS)) {
      set({ clusteringError: `unknown algorithm: ${algoKey}` });
      return;
    }
    set({ clusteringInProgress: true, clusteringError: null, selectedCluster: null });
    try {
      const emb = await api.embeddings(selectedScanName);
      // Bail if the user switched brains while we were waiting on the fetch.
      if (get().selectedScanName !== selectedScanName) return;

      // Run synchronously — k-means on ~600×512 floats is fast enough that a
      // worker thread is overkill for now. If we add bigger algorithms later
      // we can spin one up.
      const result = runClustering(algoKey, emb.data, emb.shape, algoParams);

      if (get().selectedScanName !== selectedScanName) return;
      set({
        clusterResult: result,
        clusteringInProgress: false,
        // Auto-advance to phase 2 so the user sees the partition immediately.
        currentPhase: 2,
      });
    } catch (e) {
      if (get().selectedScanName !== selectedScanName) return;
      set({
        clusteringError: (e as Error).message,
        clusteringInProgress: false,
      });
    }
  },

  setSelectedCluster: (clusterId) => set({ selectedCluster: clusterId }),

  clearClusterResult: () =>
    set({
      clusterResult: null,
      selectedCluster: null,
      clusteringError: null,
      currentPhase: 1,
    }),
}));
