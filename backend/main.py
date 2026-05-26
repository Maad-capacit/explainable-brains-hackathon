"""
FastAPI app — Mouse Brain Patch Viewer backend.

Endpoints:
  GET /api/brains
  GET /api/brains/{scan_name}/patches
  GET /api/brains/{scan_name}/patches/{patch_idx}/image
  GET /api/brains/{scan_name}/patches/{patch_idx}/thumbnail

Run (from repo root):
  uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from . import data_access

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Mouse Brain Patch Viewer")

# Frontend runs on Vite (5173 by default). Permissive in dev; tighten for prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm_metadata():
    data_access.load_metadata()


@app.on_event("shutdown")
def _shutdown():
    data_access.shutdown()


@app.get("/api/brains")
def get_brains():
    return data_access.list_brains()


@app.get("/api/brains/{scan_name}/patches")
def get_patches(scan_name: str):
    try:
        return data_access.brain_metadata(scan_name)
    except KeyError:
        raise HTTPException(404, f"unknown scan_name: {scan_name}")


@app.get(
    "/api/brains/{scan_name}/patches/{patch_idx}/image",
    responses={200: {"content": {"image/png": {}}}},
)
def get_patch_image(scan_name: str, patch_idx: int):
    try:
        png = data_access.patch_image_png(scan_name, patch_idx)
    except (KeyError, FileNotFoundError) as e:
        raise HTTPException(404, str(e))
    except IndexError as e:
        raise HTTPException(404, str(e))
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@app.get(
    "/api/brains/{scan_name}/patches/{patch_idx}/thumbnail",
    responses={200: {"content": {"image/png": {}}}},
)
def get_patch_thumbnail(scan_name: str, patch_idx: int):
    try:
        png = data_access.patch_thumbnail_png(scan_name, patch_idx)
    except (KeyError, FileNotFoundError) as e:
        raise HTTPException(404, str(e))
    except IndexError as e:
        raise HTTPException(404, str(e))
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/health")
def health():
    return {"status": "ok"}
