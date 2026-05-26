"""Quick t-SNE of all PLIP embeddings, colored by several attributes."""

from __future__ import annotations

from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.manifold import TSNE

REPO = Path(__file__).resolve().parent.parent
EMB_DIR = REPO / "data" / "challengeA" / "embeddings"
META_CSV = REPO / "data_cache" / "all_patches_metadata.csv"
COORDS_CACHE = REPO / "scripts" / "tsne_coords.npz"
OUT = REPO / "scripts" / "tsne_embeddings.png"


def load_all() -> tuple[np.ndarray, list[str], list[int]]:
    """Concat embeddings across all brains, in sorted-filename order.

    Returns embeddings, scan_name per row, patch_idx per row (within-brain).
    """
    embs, scans, idxs = [], [], []
    for f in sorted(EMB_DIR.glob("*_embeddings.h5")):
        scan = f.name.replace("_embeddings.h5", "")
        with h5py.File(f, "r") as h:
            arr = h["embeddings"][...]
        embs.append(arr)
        scans.extend([scan] * len(arr))
        idxs.extend(range(len(arr)))
    return np.vstack(embs), scans, idxs


def compute_or_load_coords(X: np.ndarray) -> np.ndarray:
    if COORDS_CACHE.exists():
        d = np.load(COORDS_CACHE)
        if d["coords"].shape[0] == X.shape[0]:
            print(f"Loaded cached t-SNE coords from {COORDS_CACHE}")
            return d["coords"]
    print("Running t-SNE (cosine, perplexity=30)…")
    coords = TSNE(
        n_components=2,
        metric="cosine",
        perplexity=30,
        init="pca",
        random_state=0,
    ).fit_transform(X)
    np.savez(COORDS_CACHE, coords=coords)
    return coords


def main():
    print("Loading embeddings…")
    X, scans, idxs = load_all()
    df = pd.DataFrame({"scan_name": scans, "patch_idx": idxs})
    print(f"  {X.shape[0]} patches × {X.shape[1]} dims, from {df['scan_name'].nunique()} brains")

    meta = pd.read_csv(META_CSV)
    df = df.merge(
        meta[["scan_name", "patch_idx", "group_nr", "sharpness", "mean_intensity", "fraction_signal"]],
        on=["scan_name", "patch_idx"], how="left",
    )
    assert df["group_nr"].notna().all(), "embedding rows failed to join metadata"

    coords = compute_or_load_coords(X)
    df["x"], df["y"] = coords[:, 0], coords[:, 1]

    fig, axes = plt.subplots(2, 2, figsize=(15, 13))

    # 1) Group
    ax = axes[0, 0]
    for g, color, label in [
        ("G001", "#1f77b4", "G001 Vehicle"),
        ("G002", "#d62728", "G002 Semaglutide"),
    ]:
        m = df["group_nr"] == g
        ax.scatter(df.loc[m, "x"], df.loc[m, "y"], s=4, alpha=0.5, c=color, label=f"{label} (n={m.sum()})")
    ax.set_title("By group")
    ax.legend(loc="best", fontsize=8)

    # 2) Scan (per-brain batch effects)
    ax = axes[0, 1]
    scan_names = sorted(df["scan_name"].unique())
    cmap = plt.get_cmap("tab20", len(scan_names))
    for i, scan in enumerate(scan_names):
        m = df["scan_name"] == scan
        # short label: animal id
        short = next((p for p in scan.split("_") if p.startswith("AN")), scan[:6])
        ax.scatter(df.loc[m, "x"], df.loc[m, "y"], s=4, alpha=0.6, c=[cmap(i)], label=short)
    ax.set_title("By brain (animal)")
    ax.legend(loc="best", fontsize=6, ncols=2, markerscale=2)

    # 3) Sharpness (log scale — heavy tail)
    ax = axes[1, 0]
    sharp = np.log1p(df["sharpness"].values)
    sc = ax.scatter(df["x"], df["y"], s=4, alpha=0.6, c=sharp, cmap="viridis")
    ax.set_title("By sharpness (log1p Laplacian variance)")
    plt.colorbar(sc, ax=ax, label="log(1 + sharpness)")

    # 4) Mean intensity
    ax = axes[1, 1]
    sc = ax.scatter(df["x"], df["y"], s=4, alpha=0.6, c=df["mean_intensity"], cmap="magma")
    ax.set_title("By mean intensity")
    plt.colorbar(sc, ax=ax, label="mean_intensity")

    for ax in axes.flat:
        ax.set_xlabel("t-SNE 1")
        ax.set_ylabel("t-SNE 2")
        ax.set_aspect("equal", adjustable="datalim")

    fig.suptitle(f"PLIP embeddings t-SNE — {len(df)} patches, {df['scan_name'].nunique()} brains", fontsize=14)
    fig.tight_layout()
    fig.savefig(OUT, dpi=130)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
