"""
Per-brain PLIP embeddings access.

Bucket layout: challengeA/embeddings/{scan_name}_embeddings.h5
  dataset 'embeddings': (N, 512) float32, L2-normalized

Lazy-downloads to data_cache/embeddings/ on first access. The whole array is
small (~1-1.5 MB per brain), so we just read it fully into memory once per
brain and cache the resulting numpy array.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Optional

import h5py
import numpy as np

from .data_access import DATA_CACHE_DIR, LOCAL_DATA_DIR

log = logging.getLogger(__name__)

BUCKET_PREFIX = "challengeA/embeddings"
EMB_CACHE_DIR = DATA_CACHE_DIR / "embeddings"

# Cap how many brains' embeddings we keep resident in memory.
ARRAY_LRU_LIMIT = 6


_arrays: "OrderedDict[str, np.ndarray]" = OrderedDict()
_lock = threading.Lock()


def _local_path(scan_name: str) -> Path:
    fname = f"{scan_name}_embeddings.h5"
    if LOCAL_DATA_DIR is not None:
        return LOCAL_DATA_DIR / fname
    return EMB_CACHE_DIR / fname


def _ensure_local(scan_name: str) -> Path:
    path = _local_path(scan_name)
    if path.exists():
        return path
    if LOCAL_DATA_DIR is not None:
        raise FileNotFoundError(
            f"{path} not found and MOUSE_BRAIN_DATA_DIR is set "
            f"(no bucket fallback in local mode)"
        )

    EMB_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    from bucket_access.bucket_utils import download_file

    s3_key = f"{BUCKET_PREFIX}/{scan_name}_embeddings.h5"
    log.info("Downloading %s from bucket…", s3_key)
    download_file(s3_key, str(path))
    return path


def load(scan_name: str) -> np.ndarray:
    """Return the (N, 512) float32 embeddings array for one brain."""
    with _lock:
        if scan_name in _arrays:
            _arrays.move_to_end(scan_name)
            return _arrays[scan_name]

        path = _ensure_local(scan_name)
        with h5py.File(path, "r") as h:
            arr = np.asarray(h["embeddings"][...], dtype=np.float32, order="C")
        _arrays[scan_name] = arr
        _arrays.move_to_end(scan_name)
        while len(_arrays) > ARRAY_LRU_LIMIT:
            _arrays.popitem(last=False)
        return arr


def as_bytes(scan_name: str) -> tuple[bytes, tuple[int, int]]:
    """Return (raw float32 little-endian bytes, shape) for streaming to the browser."""
    arr = load(scan_name)
    # Numpy float32 in-memory layout is already little-endian on x86; force it
    # explicitly so the client can always read as Float32Array without checking.
    if arr.dtype.byteorder == ">" or (arr.dtype.byteorder == "=" and np.little_endian is False):
        arr = arr.astype("<f4")
    return arr.tobytes(), tuple(arr.shape)  # type: ignore[return-value]
