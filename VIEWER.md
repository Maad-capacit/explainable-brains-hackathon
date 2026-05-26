# Mouse Brain Patch Viewer

A small web app for browsing the Challenge A patch dataset: pick a brain, scroll its
patches, click one to see its full image, metadata, and where it sits in the brain.

```
┌──────────────────────────────────────────────────────────────────┐
│  Top bar — app name + selected brain                             │
├──────────┬──────────────────────────────┬────────────────────────┤
│  Brains  │   Patch thumbnails           │  3D scatter of patch   │
│  (12)    │   (virtualized grid)         │  origins (x0,y0,z0)    │
│          │   click → detail modal       │  hover ↔ grid sync     │
└──────────┴──────────────────────────────┴────────────────────────┘
```

- **Backend:** FastAPI · h5py · Pillow — lazy-slices patches out of H5 files, windows
  uint16 → uint8 (1st–99th percentile), serves PNGs.
- **Frontend:** React 19 · TypeScript · Vite · Tailwind v4 · Zustand · `react-window`
  v2 (virtualized grid) · Plotly.js (`gl3d` partial bundle, ~3 KB wrapper).

---

## Prerequisites

- Python 3.11 (the repo's existing `environment.yml` / `.venv` works)
- Node 22+ and npm
- Optional: Hetzner bucket access via `bucket_access/config.py` (already in the repo)

---

## Quickstart — local sample data (no bucket needed)

Generates one synthetic brain with 10 patches so the viewer runs without network.

```bash
# 1. Make the sample H5 + CSV under data/sample/
python scripts/make_sample_data.py

# 2. Backend (from repo root)
pip install -r backend/requirements.txt
MOUSE_BRAIN_DATA_DIR=$(pwd)/data/sample uvicorn backend.main:app --reload --port 8000

# 3. Frontend (in another shell)
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

Open http://localhost:5173. You should see one brain in the left panel with 10 patches.

---

## Quickstart — real data via the bucket

Default mode. The first time you click a brain, its `~50 MB` patches H5 is
downloaded from the bucket to `data_cache/` and re-used for all subsequent requests.

```bash
# 1. Backend (from repo root) — no MOUSE_BRAIN_DATA_DIR set
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# 2. Frontend (in another shell)
cd frontend
npm install
npm run dev
```

First open is slow (one bucket fetch per brain on first selection). Switching back
to an already-cached brain is instant.

---

## How the backend finds your data

`backend/data_access.py` resolves data in this order:

| Variable / location                | Behavior                                                                                 |
|------------------------------------|------------------------------------------------------------------------------------------|
| `MOUSE_BRAIN_DATA_DIR=/path/to/dir` | **Local-only mode.** Reads `all_patches_metadata.csv` + `{scan_name}_patches.h5` files from `<dir>`. No bucket fallback. 404s if the file is missing. |
| `DATA_CACHE_DIR=/path/to/cache`    | Where bucket-mode downloads land (default: `<repo>/data_cache`). Already gitignored. |
| (neither set)                      | **Bucket mode.** Reads CSV + H5s from the Hetzner bucket via `bucket_access/`, caches them to `data_cache/` on first access. |

Caching:
- H5 file handles are kept open in an in-process LRU pool (max 6).
- PNG bytes are cached per `(scan, patch_idx, kind)` with `functools.lru_cache`
  (2048 full / 4096 thumbnails ≈ ~100 MB ceiling).

---

## API

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/brains` | List of `{scan_name, condition, animal_nr, group_nr, n_patches}` for all brains. |
| `GET` | `/api/brains/{scan_name}/patches` | Full per-patch metadata array for one brain (sourced from the CSV, no H5 open required). |
| `GET` | `/api/brains/{scan_name}/patches/{idx}/image` | 256×256 grayscale PNG (windowed). |
| `GET` | `/api/brains/{scan_name}/patches/{idx}/thumbnail` | 128×128 grayscale PNG. |
| `GET` | `/api/health` | `{status: "ok"}`. |

OpenAPI/Swagger docs at `http://localhost:8000/docs`.

---

## Adding a new brain

The viewer treats one row per patch in `all_patches_metadata.csv` as the source of
truth for "what brains exist". To add a new one:

1. Drop `{scan_name}_patches.h5` next to the existing H5s
   (e.g. into the `MOUSE_BRAIN_DATA_DIR` folder, or into `data_cache/` in bucket mode).
   The H5 needs:
   - `patches` dataset: shape `(N, 256, 256)`, dtype `uint16`
   - `metadata` structured dataset with columns:
     `patch_idx, z0, y0, x0, z_mid_absolute, mean_intensity, std_intensity,
     fraction_signal, sharpness, snr, local_contrast, foreground_fraction`
   - File attrs: `scan_name, animal_nr, condition, voxel_size_um, n_patches`
2. Append one CSV row per patch to `all_patches_metadata.csv`, adding
   `scan_name`, `animal_nr`, `group_nr`, `condition`, `source_file` columns.
3. Restart the backend (the CSV is loaded once at startup).

See `scripts/make_sample_data.py` for a working example that produces a brain in this
exact format.

---

## Frontend layout cheat-sheet

- `src/App.tsx` — top bar + three-column grid + detail modal portal
- `src/store.ts` — Zustand store (brains, patches, hover/selection, scroll bridge)
- `src/lib/api.ts` — typed client matching the backend's Pydantic models
- `src/components/BrainListPanel.tsx` — left panel
- `src/components/PatchGrid.tsx` — virtualized thumbnail grid (`react-window` v2 + `ResizeObserver`)
- `src/components/CoordScatter.tsx` — right-panel 3D Plotly scatter, two traces (base + highlight overlay)
- `src/components/PatchDetailModal.tsx` — modal with full image, metadata, and three SVG mini-projections

The hover sync wires through the store:
- Grid hover → `setHovered(idx)` → scatter `useEffect` calls `Plotly.restyle` on trace 1
- Scatter hover → `plotly_hover` → `setHovered(idx)` + `scrollToPatchIdx(idx)` (registered by `PatchGrid`)
- Either side's click → `openDetail(idx)` → modal opens
- Inside the modal: `Esc` closes; `←`/`→` step through patches in CSV order

---

## Design tokens (in `src/index.css`)

```css
--color-bg:           #000;
--color-panel:        rgba(20, 20, 20, 0.85);
--color-panel-border: rgba(255, 255, 255, 0.08);
--color-control:      #7FE3B5;  /* mint  */
--color-semaglutide:  #E91E63;  /* magenta */
--color-highlight:    #FFB627;  /* selection / hover */
--color-fg:           #f5f5f5;
--color-fg-dim:       rgba(245, 245, 245, 0.55);
```

---

## Out of scope (for now)

Per the original MVP brief: no embeddings, no UMAP, no automated patch selection, no
condition-comparison views. Those land in future phases — the four-endpoint backend
+ Zustand store are designed so new panels slot in without restructuring.
