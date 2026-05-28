// Typed client for the FastAPI backend.
// Routes go through Vite's /api proxy (see vite.config.ts) in dev.

export type Condition = "Control" | "Semaglutide";

export interface BrainSummary {
  scan_name: string;
  condition: Condition;
  animal_nr: string;
  group_nr: string;
  n_patches: number;
}

export interface PatchMetadata {
  patch_idx: number;
  scan_name: string;
  condition: Condition;
  animal_nr: string;
  group_nr: string;
  z0: number;
  y0: number;
  x0: number;
  z_mid_absolute: number;
  mean_intensity: number;
  std_intensity: number;
  fraction_signal: number;
  sharpness: number;
  snr: number;
  local_contrast: number;
  foreground_fraction: number;
}

// Maad's offline UMAP projection — one record per patch across the whole dataset.
// text_cluster_id is the PLIP zero-shot vocab match (see scripts/text_cluster.py).
export interface ProjectionPoint {
  patch_idx: number;
  scan_name: string;
  x: number;
  y: number;
  cluster_id: number;
  text_cluster_id: number;
  group_nr: string;
}

// Raw PLIP embeddings for one brain — used for in-browser clustering.
export interface BrainEmbeddings {
  data: Float32Array;
  shape: [number, number]; // [N, 512]
}

// Prompt-based (PLIP) clustering: each prompt is one cluster. assignments[scan]
// holds the winning prompt index per patch_idx (see backend/semantic.py).
export interface SemanticClusterResult {
  labels: string[];
  assignments: Record<string, number[]>;
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} → ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

async function getEmbeddings(scan: string): Promise<BrainEmbeddings> {
  const url = `/api/brains/${encodeURIComponent(scan)}/embeddings`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status} ${r.statusText}`);
  const shapeHeader = r.headers.get("x-embeddings-shape") ?? "";
  const parts = shapeHeader.split(",").map((s) => parseInt(s, 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    throw new Error(`bad X-Embeddings-Shape header: '${shapeHeader}'`);
  }
  const buf = await r.arrayBuffer();
  return { data: new Float32Array(buf), shape: [parts[0]!, parts[1]!] };
}

export const api = {
  brains: () => getJSON<BrainSummary[]>("/api/brains"),
  patches: (scan: string) =>
    getJSON<PatchMetadata[]>(`/api/brains/${encodeURIComponent(scan)}/patches`),
  projection: () => getJSON<ProjectionPoint[]>("/api/projection"),
  textLabels: () => getJSON<string[]>("/api/text-labels"),
  semanticCluster: (prompts: string[]) =>
    postJSON<SemanticClusterResult>("/api/semantic-cluster", { prompts }),
  embeddings: getEmbeddings,
  thumbnailURL: (scan: string, idx: number) =>
    `/api/brains/${encodeURIComponent(scan)}/patches/${idx}/thumbnail`,
  imageURL: (scan: string, idx: number) =>
    `/api/brains/${encodeURIComponent(scan)}/patches/${idx}/image`,
};
