// Browser-side clustering of PLIP embeddings.
//
// PLIP embeddings are L2-normalized on the unit hypersphere, so squared-Euclidean
// distance is monotonic in cosine distance and standard k-means gives the same
// partitioning a cosine k-means would.
//
// The algorithm registry is intentionally extensible: each algorithm declares a
// param schema (rendered into the config UI automatically) and exposes a `run`
// function that takes the raw embedding buffer + params and returns one cluster
// label per row. To add HDBSCAN / agglomerative / etc. later, drop another entry
// in ALGORITHMS.

import { kmeans } from "ml-kmeans";

export type AlgoKey = "umap";

export type ParamType = "int" | "float" | "select";

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

export type ParamValues = Record<string, number | string>;

export interface ClusteringResult {
  labels: Int32Array;        // cluster id per row, aligned with the embedding row order
  centroids?: number[][];    // present if the algorithm produces them
  iterations?: number;       // present if the algorithm reports it
  algorithmKey: AlgoKey;
  params: ParamValues;       // exact params used (for caching / display)
  durationMs: number;
}

export interface Algorithm {
  key: AlgoKey;
  label: string;
  description: string;
  params: ParamSpec[];
  run(
    embeddings: Float32Array,
    shape: [number, number],
    params: ParamValues,
  ): Omit<ClusteringResult, "algorithmKey" | "params" | "durationMs">;
}

// ── UMAP (k-means on embeddings) ─────────────────────────────────────────────

const umapAlgo: Algorithm = {
  key: "umap",
  label: "UMAP",
  description:
    "UMAP-family clustering: k-means with k-means++ init on L2-normalized PLIP embeddings (squared-Euclidean ≈ cosine).",
  params: [
    {
      key: "n_clusters",
      label: "Number of clusters (k)",
      type: "int",
      default: 8,
      min: 2,
      max: 30,
      step: 1,
      description: "How many groups to partition patches into.",
    },
    {
      key: "max_iterations",
      label: "Max iterations",
      type: "int",
      default: 100,
      min: 10,
      max: 1000,
      step: 10,
    },
    {
      key: "initialization",
      label: "Initialization",
      type: "select",
      default: "kmeans++",
      options: [
        { value: "kmeans++", label: "k-means++ (recommended)" },
        { value: "random", label: "random" },
        { value: "mostDistant", label: "most distant" },
      ],
    },
    {
      key: "seed",
      label: "Random seed",
      type: "int",
      default: 0,
      min: 0,
      max: 999999,
      step: 1,
      description: "Same seed + same params → reproducible result.",
    },
  ],
  run(embeddings, shape, params) {
    const [N, D] = shape;
    if (N === 0) return { labels: new Int32Array(0) };

    // ml-kmeans wants number[][] — convert from Float32Array view once.
    const rows: number[][] = new Array(N);
    for (let i = 0; i < N; i++) {
      const row = new Array<number>(D);
      const off = i * D;
      for (let j = 0; j < D; j++) row[j] = embeddings[off + j]!;
      rows[i] = row;
    }

    const kRaw = Number(params.n_clusters);
    const k = Math.max(2, Math.min(Math.floor(kRaw), Math.max(2, N - 1)));

    const out = kmeans(rows, k, {
      maxIterations: Number(params.max_iterations) || 100,
      initialization: params.initialization as "kmeans++" | "random" | "mostDistant",
      seed: Number(params.seed) || 0,
    });

    return {
      labels: Int32Array.from(out.clusters),
      centroids: out.centroids as unknown as number[][],
      iterations: out.iterations,
    };
  },
};

export const ALGORITHMS: Record<AlgoKey, Algorithm> = {
  umap: umapAlgo,
};

export function defaultParams(algoKey: AlgoKey): ParamValues {
  const algo = ALGORITHMS[algoKey];
  const out: ParamValues = {};
  for (const p of algo.params) out[p.key] = p.default;
  return out;
}

export function runClustering(
  algoKey: AlgoKey,
  embeddings: Float32Array,
  shape: [number, number],
  params: ParamValues,
): ClusteringResult {
  const algo = ALGORITHMS[algoKey];
  const t0 = performance.now();
  const partial = algo.run(embeddings, shape, params);
  const durationMs = performance.now() - t0;
  return { ...partial, algorithmKey: algoKey, params: { ...params }, durationMs };
}
