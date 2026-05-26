# Backend — Mouse Brain Patch Viewer

FastAPI service that serves mouse brain patches and metadata from the Hetzner bucket.

## Start

Run from the **repo root**:

```bash
uvicorn backend.main:app --reload --port 8000
```

The server starts at `http://localhost:8000`.  
On first request, patch H5 files are downloaded from the bucket and cached in `data_cache/`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/brains` | List all 12 brains with scan name, condition, and patch count |
| `GET` | `/api/brains/{scan_name}/patches` | All per-patch metadata rows for one brain |
| `GET` | `/api/brains/{scan_name}/patches/{patch_idx}/image` | Full 256×256 PNG |
| `GET` | `/api/brains/{scan_name}/patches/{patch_idx}/thumbnail` | 128×128 PNG thumbnail |
| `GET` | `/api/health` | `{"status": "ok"}` |

Interactive docs: `http://localhost:8000/docs`

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_CACHE_DIR` | `<repo_root>/data_cache` | Where downloaded H5 files are cached |
| `MOUSE_BRAIN_DATA_DIR` | *(unset)* | Point to a local folder of H5 + CSV files to skip the bucket entirely |

## Files

| File | Description |
|------|-------------|
| `main.py` | FastAPI app, routes, CORS |
| `data_access.py` | Metadata loading, H5 LRU pool, PNG caching |
| `imaging.py` | uint16 → windowed uint8 → PNG encoding |

## Notes

- H5 patch files (~50 MB each) are downloaded on first access and re-used from cache — subsequent starts are fast.
- CORS is open to `localhost:5173` (Vite dev server). Adjust `allow_origins` in `main.py` if your frontend runs on a different port.
- Dependencies are covered by the root `requirements.txt`. No separate install needed if you already set up the project environment.
