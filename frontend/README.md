# Frontend — Mouse Brain Patch Viewer

React + TypeScript + Vite UI for exploring mouse brain image patches.  
Displays 12 brain scans, patch thumbnails, quality metrics, 3D coordinate scatter, and a 2D UMAP projection with interactive clustering.

## Start

Requires the **backend running on port 8000** first (see `backend/README.md`).

```bash
# from the frontend/ directory
npm run dev
```

Opens at **http://localhost:5173**.  
All `/api` requests are proxied to `http://localhost:8000` via Vite — no CORS config needed in dev.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production bundle → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## Stack

| Package | Role |
|---------|------|
| React 19 + TypeScript | UI framework |
| Vite 8 | Dev server and bundler |
| Tailwind CSS v4 | Styling |
| Zustand | Global state — brains, patches, clustering, hover/selection |
| Plotly.js (WebGL) | 3D coordinate scatter + 2D UMAP projection |
| react-window | Virtualized patch thumbnail grid |
| ml-kmeans | Browser-side k-means clustering on PLIP embeddings |
| lucide-react | Icons |

## Workflow

The app guides researchers through three phases:

**Phase 1 — Explore**  
Select a brain from the sidebar to load its patches. Browse thumbnails in the virtualized grid. Hover a patch to highlight it in the 3D scatter and UMAP panel. Click a patch to open the detail modal (full-res image, 11 metadata fields, XY/YZ/XZ mini-projections). Configure clustering parameters (cluster count, initialization, seed) in the config bar and click **Run**.

**Phase 2 — Review clusters**  
After clustering completes, patches are organized into labeled cluster folders. Select a folder to view all its patches. The UMAP panel updates to reflect cluster coloring across the full dataset or just the selected brain.

**Phase 3 — Label** *(not yet implemented)*  
Placeholder for future human-in-the-loop annotation.

## Structure

```
src/
├── main.tsx                   Entry point
├── App.tsx                    Root layout — 3-column grid + modal portal
├── store.ts                   Zustand store — all app state + async actions
├── index.css                  Tailwind base styles
├── lib/
│   ├── api.ts                 Typed fetch client for the FastAPI backend
│   └── clustering.ts          Browser-side k-means wrapper + algorithm param schema
└── components/
    ├── TopBar.tsx             Header
    ├── BrainListPanel.tsx     Left sidebar — 12 brain scans grouped by condition
    ├── PhaseTabs.tsx          Tab navigation — Explore / Review clusters / Label
    ├── Phase1View.tsx         ClusterConfigBar + PatchGrid
    ├── Phase2View.tsx         Cluster folder buttons + filtered patch grid
    ├── Phase3View.tsx         Labeling placeholder
    ├── PatchGrid.tsx          Virtualized thumbnail grid (react-window)
    ├── ClusterConfigBar.tsx   Algorithm selector + parameter controls + Run button
    ├── UmapPanel.tsx          2D UMAP projection (global/local, UMAP/text-vocab toggle)
    ├── CoordScatter.tsx       3D Plotly scatter of patch origins (x₀, y₀, z₀)
    ├── PatchDetailModal.tsx   Full-res image, metadata table, 3 mini-projections
    └── Panel.tsx              Shared panel wrapper
```

## Notes

- `node_modules` is already present — no `npm install` needed unless you add packages.
- The Vite proxy (`vite.config.ts`) forwards `/api/*` to the backend — both servers must run simultaneously.
- The UMAP panel supports two views: **UMAP clusters** (k-means color-coded) and **text vocab** (PLIP zero-shot semantic labels). Toggle between them in the panel header.
- Production build (`dist/`) can be served statically behind the FastAPI app or any static host.
