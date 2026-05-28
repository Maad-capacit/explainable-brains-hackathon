"""
FastAPI app — Mouse Brain Patch Viewer backend.

Run (from repo root):
  uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import data_access, embeddings, projection, semantic

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
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Response models ──────────────────────────────────────────────────────────


class BrainSummary(BaseModel):
    scan_name: str = Field(..., description="Unique identifier for the scan")
    condition: str = Field(..., description="Experimental condition: Control or Semaglutide")
    animal_nr: str = Field(..., description="Animal identifier")
    group_nr: str = Field(..., description="Group: G001 (Vehicle) or G002 (Semaglutide)")
    n_patches: int = Field(..., description="Number of patches extracted from this brain")


class ProjectionPoint(BaseModel):
    patch_idx: int
    scan_name: str
    x: float
    y: float
    cluster_id: int
    text_cluster_id: int = -1
    group_nr: str


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


class SemanticClusterRequest(BaseModel):
    prompts: list[str] = Field(..., description="Text prompts; each becomes one cluster")


class SemanticClusterResponse(BaseModel):
    labels: list[str] = Field(..., description="Prompt text indexed by cluster id")
    assignments: dict[str, list[int]] = Field(
        ..., description="Per scan_name, the winning prompt index for each patch_idx"
    )


class HealthResponse(BaseModel):
    status: str


# ─── Lifecycle ────────────────────────────────────────────────────────────────


@app.on_event("startup")
def _warm_metadata():
    data_access.load_metadata()
    try:
        projection.load()
    except FileNotFoundError as e:
        logging.warning("projection not available: %s", e)


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
    "/api/brains/{scan_name}/embeddings",
    summary="Get brain's PLIP embeddings as raw float32 bytes",
    description=(
        "Returns the brain's (N, 512) L2-normalized PLIP embeddings as a "
        "contiguous little-endian float32 buffer. Shape is reported in the "
        "X-Embeddings-Shape response header as `N,D`. The browser is expected "
        "to parse this as `new Float32Array(arrayBuffer)`."
    ),
    responses={200: {"content": {"application/octet-stream": {}}}},
    tags=["Embeddings"],
)
def get_embeddings(scan_name: str):
    try:
        data, shape = embeddings.as_bytes(scan_name)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={
            "X-Embeddings-Shape": f"{shape[0]},{shape[1]}",
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get(
    "/api/projection",
    response_model=list[ProjectionPoint],
    summary="UMAP projection + cluster labels for all patches",
    description="Returns one point per patch with 2D UMAP coords, k-means cluster id, and text-vocab cluster id.",
    tags=["Projection"],
)
def get_projection():
    try:
        return projection.records()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))


@app.get(
    "/api/text-labels",
    response_model=list[str],
    summary="Text cluster vocabulary",
    description="Returns the list of PLIP vocab phrases indexed by text_cluster_id.",
    tags=["Projection"],
)
def get_text_labels():
    try:
        return projection.text_labels()
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))


@app.post(
    "/api/semantic-cluster",
    response_model=SemanticClusterResponse,
    summary="Cluster all patches by similarity to editable PLIP text prompts",
    description=(
        "Encodes the given prompts with the PLIP text encoder and assigns every "
        "patch (across all brains) to its best-matching prompt. Each prompt is one "
        "cluster. Returns per-scan assignments aligned by patch_idx."
    ),
    tags=["Projection"],
)
def post_semantic_cluster(req: SemanticClusterRequest):
    prompts = [p.strip() for p in req.prompts if p.strip()]
    if not prompts:
        raise HTTPException(400, "prompts must contain at least one non-empty string")
    try:
        labels, assignments = semantic.cluster(prompts)
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    return {"labels": labels, "assignments": assignments}


@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["System"],
)
def health():
    return {"status": "ok"}
