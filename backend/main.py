"""
FastAPI app — Mouse Brain Patch Viewer backend.

Run (from repo root):
  uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import data_access

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="Mouse Brain Patch Viewer",
    version="1.0.0",
    description=(
        "REST API for browsing mouse brain microscopy patches (Challenge A). "
        "Serves image patches from 12 light-sheet scans (Vehicle vs Semaglutide conditions) "
        "stored in a Hetzner S3 bucket."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ─── Response models ──────────────────────────────────────────────────────────


class BrainSummary(BaseModel):
    scan_name: str = Field(..., description="Unique identifier for the scan")
    condition: str = Field(..., description="Experimental condition: Control or Semaglutide")
    animal_nr: str = Field(..., description="Animal identifier")
    group_nr: str = Field(..., description="Group: G001 (Vehicle) or G002 (Semaglutide)")
    n_patches: int = Field(..., description="Number of patches extracted from this brain")


class PatchMetadata(BaseModel):
    patch_idx: int = Field(..., description="Index into the patches dataset (also aligns with embeddings)")
    scan_name: str
    condition: str
    animal_nr: str
    group_nr: str
    z0: int = Field(..., description="Origin Z coordinate in original volume")
    y0: int = Field(..., description="Origin Y coordinate in original volume")
    x0: int = Field(..., description="Origin X coordinate in original volume")
    z_mid_absolute: int = Field(..., description="Absolute Z position of the saved 2D slice")
    mean_intensity: float = Field(..., description="Mean pixel brightness")
    std_intensity: float = Field(..., description="Spread of intensities")
    fraction_signal: float = Field(..., description="Fraction of pixels above threshold (>=0.70)")
    sharpness: float = Field(..., description="Laplacian variance — higher = sharper")
    snr: float = Field(..., description="Signal-to-noise ratio (mean / std)")
    local_contrast: float = Field(..., description="Mean absolute gradient")
    foreground_fraction: float = Field(..., description="Tissue fraction via Otsu thresholding")


class HealthResponse(BaseModel):
    status: str


# ─── Lifecycle ────────────────────────────────────────────────────────────────


@app.on_event("startup")
def _warm_metadata():
    data_access.load_metadata()


@app.on_event("shutdown")
def _shutdown():
    data_access.shutdown()


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.get(
    "/api/brains",
    response_model=list[BrainSummary],
    summary="List all brains",
    description="Returns one entry per brain scan with condition, animal info, and patch count.",
    tags=["Brains"],
)
def get_brains():
    return data_access.list_brains()


@app.get(
    "/api/brains/{scan_name}/patches",
    response_model=list[PatchMetadata],
    summary="Get patch metadata for a brain",
    description="Returns all per-patch metadata rows (coordinates, quality metrics) for one brain.",
    tags=["Patches"],
)
def get_patches(scan_name: str):
    try:
        return data_access.brain_metadata(scan_name)
    except KeyError:
        raise HTTPException(404, f"unknown scan_name: {scan_name}")


@app.get(
    "/api/brains/{scan_name}/patches/{patch_idx}/image",
    summary="Get full-resolution patch image",
    description="Returns the 256×256 patch as a percentile-windowed grayscale PNG.",
    responses={200: {"content": {"image/png": {}}}},
    tags=["Patches"],
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
    summary="Get patch thumbnail",
    description="Returns a 128×128 downsampled PNG thumbnail of the patch.",
    responses={200: {"content": {"image/png": {}}}},
    tags=["Patches"],
)
def get_patch_thumbnail(scan_name: str, patch_idx: int):
    try:
        png = data_access.patch_thumbnail_png(scan_name, patch_idx)
    except (KeyError, FileNotFoundError) as e:
        raise HTTPException(404, str(e))
    except IndexError as e:
        raise HTTPException(404, str(e))
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["System"],
)
def health():
    return {"status": "ok"}
