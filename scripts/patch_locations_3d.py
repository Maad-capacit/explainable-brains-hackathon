"""3D scatter of patch sampling locations, per brain (4×3 grid of subplots)."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
META_CSV = REPO / "data_cache" / "all_patches_metadata.csv"
OUT = REPO / "scripts" / "patch_locations_3d.png"

# Patch subvolume size (per CHALLENGE_A.md: 256×256×64)
PX, PY, PZ = 256, 256, 64


def main():
    df = pd.read_csv(META_CSV)
    # patch center in original volume coords
    df["cx"] = df["x0"] + PX / 2
    df["cy"] = df["y0"] + PY / 2
    df["cz"] = df["z0"] + PZ / 2

    scans = sorted(df["scan_name"].unique())
    n = len(scans)
    cols, rows = 4, 3

    fig = plt.figure(figsize=(18, 13))
    fig.suptitle(f"Patch sampling locations per brain ({len(df)} patches across {n} brains)", fontsize=14)

    # shared axis ranges so brains are visually comparable
    xlim = (df["cx"].min(), df["cx"].max())
    ylim = (df["cy"].min(), df["cy"].max())
    zlim = (df["cz"].min(), df["cz"].max())

    for i, scan in enumerate(scans):
        sub = df[df["scan_name"] == scan]
        ax = fig.add_subplot(rows, cols, i + 1, projection="3d")
        group = sub["group_nr"].iloc[0]
        animal = sub["animal_nr"].iloc[0]
        color = "#1f77b4" if group == "G001" else "#d62728"
        ax.scatter(sub["cx"], sub["cy"], sub["cz"], s=2, alpha=0.5, c=color)
        label = "Vehicle" if group == "G001" else "Sema"
        ax.set_title(f"{animal} ({group} {label}) — n={len(sub)}", fontsize=10)
        ax.set_xlim(xlim)
        ax.set_ylim(ylim)
        ax.set_zlim(zlim)
        ax.set_xlabel("x", fontsize=8)
        ax.set_ylabel("y", fontsize=8)
        ax.set_zlabel("z", fontsize=8)
        ax.tick_params(labelsize=7)
        # match anatomical orientation: y typically increases anterior→posterior,
        # z increases dorsal→ventral. Flip z so dorsal is up.
        ax.invert_zaxis()

    fig.tight_layout(rect=(0, 0, 1, 0.97))
    fig.savefig(OUT, dpi=130)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
