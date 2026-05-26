# Frontend — Mouse Brain Patch Viewer

React + TypeScript + Vite UI for browsing mouse brain image patches.
Displays all 12 brain scans, patch thumbnails, quality metrics, and a coordinate scatter plot.

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
| Zustand | Global state (selected brain, patches, hover/selection) |
| lucide-react | Icons |

## Structure

```
src/
├── main.tsx                   Entry point
├── App.tsx                    Root layout
├── store.ts                   Zustand store — brains, patches, hover/selection state
├── index.css                  Tailwind base styles
├── lib/
│   └── api.ts                 Typed fetch client for the FastAPI backend
└── components/
    ├── TopBar.tsx             Header
    ├── BrainListPanel.tsx     Sidebar — list of 12 brain scans
    ├── PatchGrid.tsx          Thumbnail grid for selected brain
    ├── CoordScatter.tsx       XYZ coordinate scatter plot
    └── Panel.tsx              Shared panel wrapper
```

## Notes

- `node_modules` is already present — no `npm install` needed unless you add packages.
- The Vite proxy (`vite.config.ts`) forwards `/api/*` to the backend, so the frontend and backend must run simultaneously.
- Production build (`dist/`) can be served statically behind the FastAPI app or any static host.
