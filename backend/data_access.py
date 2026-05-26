"""
Data access layer for the patch viewer.

Source of truth: the Hetzner bucket (via bucket_access).
H5 patch files (~50 MB each) are downloaded once to DATA_CACHE_DIR
on first access, then read with h5py.File handles kept open in an LRU pool.

A purely local mode is also supported: set MOUSE_BRAIN_DATA_DIR to a folder
that contains all_patches_metadata.csv + {scan_name}_patches.h5 files,
and the bucket will not be touched.
"""

from __future__ import annotations

import logging
import os
import threading
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path
from typing import Optional

import h5py
import numpy as np
import pandas as pd

from .imaging import encode_png

log = logging.getLogger(__name__)

# Repo root (assumes backend/ is one level deep)
REPO_ROOT = Path(__file__).resolve().parent.parent

# Local cache for bucket downloads (gitignored: *.h5, *.csv)
DATA_CACHE_DIR = Path(os.environ.get("DATA_CACHE_DIR", REPO_ROOT / "data_cache"))

# Optional local override — if set, read everything from here, skip bucket
LOCAL_DATA_DIR = (
    Path(os.environ["MOUSE_BRAIN_DATA_DIR"]).resolve()
    if os.environ.get("MOUSE_BRAIN_DATA_DIR")
    else None
)

# Bucket prefix for patch files
BUCKET_PREFIX = "challengeA/patches"

# Max number of H5 file handles to keep open at once
H5_HANDLE_LIMIT = 6


# ─────────────────────────────────────────────────────────────────────────────
# Metadata (CSV) — loaded once at startup
# ─────────────────────────────────────────────────────────────────────────────

_metadata_df: Optional[pd.DataFrame] = None
_metadata_lock = threading.Lock()


def _metadata_csv_path() -> Path:
    """Resolve the metadata CSV path, downloading from the bucket if needed."""
    if LOCAL_DATA_DIR is not None:
        return LOCAL_DATA_DIR / "all_patches_metadata.csv"

    cached = DATA_CACHE_DIR / "all_patches_metadata.csv"
    if not cached.exists():
        DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        from bucket_access.bucket_utils import download_file

        log.info("Downloading all_patches_metadata.csv from bucket…")
        download_file(f"{BUCKET_PREFIX}/all_patches_metadata.csv", str(cached))
    return cached


def load_metadata() -> pd.DataFrame:
    global _metadata_df
    with _metadata_lock:
        if _metadata_df is None:
            _metadata_df = pd.read_csv(_metadata_csv_path())
            log.info("Loaded metadata: %d rows, %d scans", len(_metadata_df), _metadata_df["scan_name"].nunique())
        return _metadata_df


def list_brains() -> list[dict]:
    """Return one dict per brain with summary info."""
    df = load_metadata()
    grouped = (
        df.groupby("scan_name", sort=True)
        .agg(
            condition=("condition", "first"),
            animal_nr=("animal_nr", "first"),
            group_nr=("group_nr", "first"),
            n_patches=("patch_idx", "count"),
        )
        .reset_index()
    )
    return grouped.to_dict(orient="records")


def brain_metadata(scan_name: str) -> list[dict]:
    """Return all per-patch metadata rows for one brain."""
    df = load_metadata()
    sub = df[df["scan_name"] == scan_name]
    if sub.empty:
        raise KeyError(scan_name)
    # Drop the redundant source_file column from the per-brain view
    cols = [c for c in sub.columns if c not in ("source_file",)]
    return sub[cols].to_dict(orient="records")


# ─────────────────────────────────────────────────────────────────────────────
# H5 file handles — LRU pool
# ─────────────────────────────────────────────────────────────────────────────


class _H5Pool:
    """Small LRU pool of open h5py.File handles, keyed by scan_name."""

    def __init__(self, limit: int = H5_HANDLE_LIMIT):
        self._files: OrderedDict[str, h5py.File] = OrderedDict()
        self._limit = limit
        self._lock = threading.Lock()

    def get(self, scan_name: str) -> h5py.File:
        with self._lock:
            if scan_name in self._files:
                self._files.move_to_end(scan_name)
                return self._files[scan_name]

            path = _ensure_h5_local(scan_name)
            f = h5py.File(path, "r")
            self._files[scan_name] = f
            self._files.move_to_end(scan_name)

            while len(self._files) > self._limit:
                _, evicted = self._files.popitem(last=False)
                try:
                    evicted.close()
                except Exception:
                    log.exception("error closing evicted h5 file")
            return f

    def close_all(self):
        with self._lock:
            for f in self._files.values():
                try:
                    f.close()
                except Exception:
                    pass
            self._files.clear()


_pool = _H5Pool()


def _h5_local_path(scan_name: str) -> Path:
    filename = f"{scan_name}_patches.h5"
    if LOCAL_DATA_DIR is not None:
        return LOCAL_DATA_DIR / filename
    return DATA_CACHE_DIR / filename


def _ensure_h5_local(scan_name: str) -> Path:
    """Return a local path to the brain's H5 file, downloading from the bucket if missing."""
    path = _h5_local_path(scan_name)
    if path.exists():
        return path
    if LOCAL_DATA_DIR is not None:
        raise FileNotFoundError(
            f"{path} not found and MOUSE_BRAIN_DATA_DIR is set to {LOCAL_DATA_DIR} (no bucket fallback)"
        )

    DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    from bucket_access.bucket_utils import download_file

    s3_key = f"{BUCKET_PREFIX}/{scan_name}_patches.h5"
    log.info("Downloading %s from bucket…", s3_key)
    download_file(s3_key, str(path))
    return path


# ─────────────────────────────────────────────────────────────────────────────
# Patch image rendering — with LRU cache on encoded PNG bytes
# ─────────────────────────────────────────────────────────────────────────────


def _read_patch(scan_name: str, patch_idx: int) -> np.ndarray:
    f = _pool.get(scan_name)
    ds = f["patches"]
    if patch_idx < 0 or patch_idx >= ds.shape[0]:
        raise IndexError(f"patch_idx {patch_idx} out of range for {scan_name} (N={ds.shape[0]})")
    return ds[patch_idx]


@lru_cache(maxsize=2048)
def patch_image_png(scan_name: str, patch_idx: int) -> bytes:
    patch = _read_patch(scan_name, patch_idx)
    return encode_png(patch, size=None)


@lru_cache(maxsize=4096)
def patch_thumbnail_png(scan_name: str, patch_idx: int) -> bytes:
    patch = _read_patch(scan_name, patch_idx)
    return encode_png(patch, size=128)


def shutdown():
    _pool.close_all()
    patch_image_png.cache_clear()
    patch_thumbnail_png.cache_clear()
