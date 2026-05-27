# Backend — Mouse Brain Patch Viewer

FastAPI service that serves mouse brain patches, metadata, PLIP embeddings, and UMAP projection data from the Hetzner bucket.

## Start

Run from the **repo root**:

```bash
uvicorn backend.main:app --reload --port 8000
```

The server starts at `http://localhost:8000`.  
On first request, H5 patch files are downloaded from the bucket and cached in `data_cache/`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/brains` | List all 12 brains with scan name, condition, and patch count |
| `GET` | `/api/brains/{scan_name}/patches` | All per-patch metadata rows for one brain |
| `GET` | `/api/brains/{scan_name}/patches/{patch_idx}/image` | Full 256×256 PNG |
| `GET` | `/api/brains/{scan_name}/patches/{patch_idx}/thumbnail` | 128×128 PNG thumbnail |
| `GET` | `/api/brains/{scan_name}/embeddings` | Raw PLIP embeddings as float32 bytes (shape in `X-Shape` header) |
| `GET` | `/api/projection` | Pre-computed UMAP 2D coordinates + k-means cluster labels for all patches |
| `GET` | `/api/text-labels` | PLIP zero-shot vocabulary labels per patch |
| `GET` | `/api/health` | `{"status": "ok"}` |

## API Documentation (Swagger)

Once the server is running, interactive docs are available at:

| URL | Format |
|-----|--------|
| [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI — interactive, try endpoints directly |
| [http://localhost:8000/redoc](http://localhost:8000/redoc) | ReDoc — clean read-only reference |
| [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json) | Raw OpenAPI 3.1 JSON spec |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_CACHE_DIR` | `<repo_root>/data_cache` | Where downloaded H5 files and cluster artifacts are cached |
| `MOUSE_BRAIN_DATA_DIR` | *(unset)* | Point to a local folder of H5 + CSV files to skip the bucket entirely |

## Files

| File | Description |
|------|-------------|
| `main.py` | FastAPI app, all routes, CORS config, startup/shutdown lifecycle |
| `data_access.py` | Metadata CSV loading, H5 file LRU pool (max 6 open handles), PNG caching |
| `embeddings.py` | Per-brain PLIP embedding loading, LRU cache, binary streaming to frontend |
| `projection.py` | UMAP 2D coordinates and k-means cluster labels loaded from parquet, thread-safe singleton, optional text-cluster assignments |
| `imaging.py` | uint16 → windowed uint8 conversion (1st–99th percentile) → PNG encoding |

## Notes

- H5 patch files (~50 MB each) are downloaded on first access and re-used from cache — subsequent starts are fast.
- UMAP projections and cluster labels are pre-computed offline by `scripts/umap_cluster.py` and stored as parquet files under `data_cache/cluster_artifacts/`.
- CORS is open to `localhost:5173` (Vite dev server). Adjust `allow_origins` in `main.py` if your frontend runs on a different port.
- Dependencies are covered by the root `requirements.txt`. No separate install needed if you already set up the project environment.
