"""
Generate a tiny synthetic dataset so the patch viewer can run without bucket access.

Writes:
  data/sample/{scan_name}_patches.h5     -- 10 patches, 256x256 uint16
  data/sample/all_patches_metadata.csv   -- one row per patch

Schema mirrors the real data in the bucket exactly.
Run from the repo root:
    python scripts/make_sample_data.py
Then run the backend in local mode:
    MOUSE_BRAIN_DATA_DIR=$(pwd)/data/sample uvicorn backend.main:app --reload
"""

from __future__ import annotations

from pathlib import Path

import h5py
import numpy as np
import pandas as pd

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "sample"
SCAN_NAME = "260101_AN0SM_DEMO_synthetic_brain"
ANIMAL_NR = "AN0SM"
GROUP_NR = "G001"
CONDITION = "Control"
N = 10
PATCH_SIZE = 256


def make_patch(rng: np.random.Generator) -> np.ndarray:
    """Synthetic-looking microscopy patch: low-freq background + bright blobs + noise."""
    yy, xx = np.mgrid[0:PATCH_SIZE, 0:PATCH_SIZE]
    bg = 200.0 + 30.0 * np.sin(xx * 0.01) + 30.0 * np.cos(yy * 0.01)
    img = bg.astype(np.float32)
    for _ in range(int(rng.integers(3, 9))):
        cx, cy = rng.uniform(40, PATCH_SIZE - 40, 2)
        sigma = rng.uniform(3.0, 14.0)
        amp = rng.uniform(400.0, 1500.0)
        img += amp * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma**2))
    img += rng.normal(0.0, 18.0, img.shape)
    return np.clip(img, 0, 65535).astype(np.uint16)


def main() -> None:
    rng = np.random.default_rng(42)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    patches = np.stack([make_patch(rng) for _ in range(N)])

    metadata_dtype = np.dtype(
        [
            ("patch_idx", "i8"),
            ("z0", "i8"),
            ("y0", "i8"),
            ("x0", "i8"),
            ("z_mid_absolute", "i8"),
            ("mean_intensity", "f4"),
            ("std_intensity", "f4"),
            ("fraction_signal", "f4"),
            ("sharpness", "f4"),
            ("snr", "f4"),
            ("local_contrast", "f4"),
            ("foreground_fraction", "f4"),
        ]
    )

    metadata = np.zeros(N, dtype=metadata_dtype)
    for i in range(N):
        p = patches[i].astype(np.float32)
        mean = float(p.mean())
        std = float(p.std())
        z0 = int(rng.integers(0, 200))
        y0 = int(rng.integers(0, 2500))
        x0 = int(rng.integers(0, 1500))
        metadata[i] = (
            i,
            z0,
            y0,
            x0,
            z0 + 32,
            mean,
            std,
            float((p > mean).mean()),
            float(rng.uniform(20.0, 80.0)),
            mean / max(std, 1.0),
            float(rng.uniform(4.0, 10.0)),
            float(rng.uniform(0.3, 0.8)),
        )

    h5_path = OUT_DIR / f"{SCAN_NAME}_patches.h5"
    with h5py.File(h5_path, "w") as h:
        h.create_dataset("patches", data=patches, compression="gzip", compression_opts=4)
        h.create_dataset("metadata", data=metadata)
        h.attrs["scan_name"] = SCAN_NAME
        h.attrs["animal_nr"] = ANIMAL_NR
        h.attrs["condition"] = CONDITION
        h.attrs["voxel_size_um"] = 5.0
        h.attrs["n_patches"] = N

    csv_rows = []
    for i in range(N):
        row = {name: metadata[i][name].item() for name in metadata.dtype.names}
        row["scan_name"] = SCAN_NAME
        row["animal_nr"] = ANIMAL_NR
        row["group_nr"] = GROUP_NR
        row["condition"] = CONDITION
        row["source_file"] = f"{SCAN_NAME}_patches.h5"
        csv_rows.append(row)

    csv_path = OUT_DIR / "all_patches_metadata.csv"
    pd.DataFrame(csv_rows).to_csv(csv_path, index=False)

    print(f"✓ Wrote {h5_path}  ({h5_path.stat().st_size / 1024:.1f} KiB)")
    print(f"✓ Wrote {csv_path}")
    print()
    print("Run the backend in local mode:")
    print(f"  MOUSE_BRAIN_DATA_DIR={OUT_DIR} uvicorn backend.main:app --reload")


if __name__ == "__main__":
    main()
