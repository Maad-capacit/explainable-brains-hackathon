const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000'

export type Condition = 'Control' | 'Semaglutide'

export type BrainSummary = {
  scan_name: string
  condition: Condition
  animal_nr: string
  group_nr: string
  n_patches: number
}

export type PatchMetadata = {
  patch_idx: number
  scan_name: string
  condition: Condition
  animal_nr: string
  group_nr: string
  z0: number
  y0: number
  x0: number
  z_mid_absolute: number
  mean_intensity: number
  std_intensity: number
  fraction_signal: number
  sharpness: number
  snr: number
  local_contrast: number
  foreground_fraction: number
}

export type ProjectionPoint = {
  patch_idx: number
  scan_name: string
  x: number
  y: number
  cluster_id: number
  group_nr: string
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  brains: () => getJSON<BrainSummary[]>('/api/brains'),
  patches: (scanName: string) => getJSON<PatchMetadata[]>(`/api/brains/${encodeURIComponent(scanName)}/patches`),
  projection: () => getJSON<ProjectionPoint[]>('/api/projection'),
  imageURL: (scanName: string, patchIdx: number) =>
    `${API_BASE}/api/brains/${encodeURIComponent(scanName)}/patches/${patchIdx}/image`,
  thumbnailURL: (scanName: string, patchIdx: number) =>
    `${API_BASE}/api/brains/${encodeURIComponent(scanName)}/patches/${patchIdx}/thumbnail`,
}
