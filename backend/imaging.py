"""uint16 patch -> windowed PNG bytes."""

from __future__ import annotations

import io

import numpy as np
from PIL import Image


def window_to_uint8(
    patch: np.ndarray,
    lo_pct: float = 1.0,
    hi_pct: float = 99.0,
) -> np.ndarray:
    """Percentile-window a 2D uint array to uint8."""
    lo, hi = np.percentile(patch, (lo_pct, hi_pct))
    if hi <= lo:
        hi = lo + 1.0
    scaled = (patch.astype(np.float32) - lo) * (255.0 / (hi - lo))
    return np.clip(scaled, 0, 255).astype(np.uint8)


def encode_png(patch: np.ndarray, size: int | None = None) -> bytes:
    """Window a uint16 patch and return PNG bytes, optionally downsampled to `size`x`size`."""
    arr8 = window_to_uint8(patch)
    img = Image.fromarray(arr8, mode="L")
    if size is not None and (img.width > size or img.height > size):
        img.thumbnail((size, size), Image.Resampling.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    return buf.getvalue()
