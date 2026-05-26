"""Sample N random patches, save as PNGs for visual inspection."""

from __future__ import annotations

import random
from pathlib import Path

import h5py
import numpy as np
import pandas as pd

from backend.imaging import encode_png

REPO = Path(__file__).resolve().parent.parent
PATCH_DIR = REPO / "data" / "challengeA" / "patches"
META_CSV = REPO / "data_cache" / "all_patches_metadata.csv"
OUT_DIR = REPO / "scripts" / "patch_samples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

N = 20
SEED = 42


def main():
    random.seed(SEED)
    np.random.seed(SEED)

    meta = pd.read_csv(META_CSV)
    sample = meta.sample(n=N, random_state=SEED).reset_index(drop=True)

    # Group sample rows by scan_name so we open each H5 once.
    by_scan = sample.groupby("scan_name")
    out_rows = []
    for scan_name, rows in by_scan:
        h5_path = PATCH_DIR / f"{scan_name}_patches.h5"
        with h5py.File(h5_path, "r") as h:
            patches = h["patches"]
            for _, r in rows.iterrows():
                idx = int(r["patch_idx"])
                arr = patches[idx]
                png_bytes = encode_png(arr, size=None)
                short = scan_name.split("_")[1]  # AN0xX
                out_name = f"{r.name:02d}_{short}_{r['group_nr']}_patch{idx:03d}.png"
                (OUT_DIR / out_name).write_bytes(png_bytes)
                out_rows.append({
                    "file": out_name,
                    "scan_name": scan_name,
                    "patch_idx": idx,
                    "group_nr": r["group_nr"],
                    "condition": r["condition"],
                    "sharpness": round(float(r["sharpness"]), 2),
                    "mean_intensity": round(float(r["mean_intensity"]), 1),
                    "fraction_signal": round(float(r["fraction_signal"]), 3),
                    "foreground_fraction": round(float(r["foreground_fraction"]), 3),
                })

    pd.DataFrame(out_rows).sort_values("file").to_csv(OUT_DIR / "_index.csv", index=False)
    print(f"Wrote {len(out_rows)} patches to {OUT_DIR}")
    print(pd.DataFrame(out_rows).sort_values("file").to_string(index=False))


if __name__ == "__main__":
    main()
