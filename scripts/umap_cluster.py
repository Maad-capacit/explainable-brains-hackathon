"""UMAP + HDBSCAN clustering of PLIP embeddings.

Two-stage UMAP:
  - 10D 'clustering' UMAP (n_neighbors=20, min_dist=0.0) → HDBSCAN
  - 2D 'visualization' UMAP (n_neighbors=20, min_dist=0.1) → scatter

Both use cosine metric since PLIP embeddings are L2-normalized.

Caches intermediate arrays so re-plotting is instant.
"""

from __future__ import annotations

from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import HDBSCAN, KMeans
import umap

REPO = Path(__file__).resolve().parent.parent
EMB_DIR = REPO / "data" / "challengeA" / "embeddings"
META_CSV = REPO / "data_cache" / "all_patches_metadata.csv"
CACHE_DIR = REPO / "data_cache" / "cluster_artifacts"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CLUSTERS_PARQUET = CACHE_DIR / "clusters.parquet"
PROJECTION_PARQUET = CACHE_DIR / "projection.parquet"
OUT_PLOT = REPO / "scripts" / "umap_clusters.png"

# ── Hyperparameters ──────────────────────────────────────────────────────────
SEED = 0

# Stage 1 — UMAP for clustering. Goal: denoise 512D → 10D while preserving
# local structure so HDBSCAN sees clean density modes.
#   n_neighbors=20: local-ish, but not so small that clusters fragment.
#   min_dist=0.0: pack points tightly so HDBSCAN finds dense regions.
#   n_components=10: enough to keep cluster structure, far less noise than 512.
CLUSTER_UMAP = dict(n_neighbors=20, min_dist=0.0, n_components=10,
                    metric="cosine", random_state=SEED)

# Stage 2 — UMAP for visualization. min_dist higher → readable scatter.
VIZ_UMAP = dict(n_neighbors=20, min_dist=0.1, n_components=2,
                metric="cosine", random_state=SEED)

# HDBSCAN with eom — gave 15 clusters, 33% noise, one cluster of ~2286 patches.
# That big cluster is the "background/low-signal" region of the manifold.
HDBSCAN_PARAMS = dict(min_cluster_size=50, min_samples=10,
                      cluster_selection_method="eom")

# K-means as the primary method — every patch gets a cluster, no noise category.
# K=20 chosen as a balance: enough granularity for downstream sampling, not so
# many that each cluster becomes hard to label semantically.
N_KMEANS = 20


def load_embeddings() -> tuple[np.ndarray, pd.DataFrame]:
    embs, scans, idxs = [], [], []
    for f in sorted(EMB_DIR.glob("*_embeddings.h5")):
        scan = f.name.replace("_embeddings.h5", "")
        with h5py.File(f, "r") as h:
            arr = h["embeddings"][...]
        embs.append(arr)
        scans.extend([scan] * len(arr))
        idxs.extend(range(len(arr)))
    return np.vstack(embs), pd.DataFrame({"scan_name": scans, "patch_idx": idxs})


def main():
    print("Loading embeddings…")
    X, df = load_embeddings()
    print(f"  X: {X.shape}, brains: {df['scan_name'].nunique()}")

    meta = pd.read_csv(META_CSV)
    df = df.merge(
        meta[["scan_name", "patch_idx", "group_nr", "condition", "sharpness"]],
        on=["scan_name", "patch_idx"], how="left",
    )

    print(f"Stage 1: UMAP → {CLUSTER_UMAP['n_components']}D for clustering…")
    X10 = umap.UMAP(**CLUSTER_UMAP).fit_transform(X)

    print(f"Stage 2: UMAP → 2D for visualization…")
    X2 = umap.UMAP(**VIZ_UMAP).fit_transform(X)

    print(f"K-means (k={N_KMEANS}) on 10D UMAP…")
    km = KMeans(n_clusters=N_KMEANS, n_init=10, random_state=SEED).fit(X10)
    labels = km.labels_.astype(np.int32)
    n_clusters = N_KMEANS
    centroids = km.cluster_centers_
    sizes = pd.Series(labels).value_counts().sort_index()
    print(f"  k-means cluster sizes (min/median/max): {sizes.min()}/{int(sizes.median())}/{sizes.max()}")

    print("HDBSCAN on 10D UMAP (for comparison)…")
    hdb_labels = HDBSCAN(**HDBSCAN_PARAMS).fit_predict(X10)
    n_hdb = hdb_labels.max() + 1
    noise_frac = (hdb_labels == -1).mean()
    print(f"  → {n_hdb} clusters, {noise_frac:.1%} noise")

    # Distance to k-means centroid (in 10D UMAP) — for exemplars + outliers later.
    dist_to_centroid = np.linalg.norm(X10 - centroids[labels], axis=1).astype(np.float32)

    # Save clustering result (matches the Phase 0 contract).
    out = df.assign(
        cluster_id=labels.astype(np.int32),
        dist_to_centroid=dist_to_centroid,
    )
    out[["patch_idx", "scan_name", "cluster_id", "dist_to_centroid"]].to_parquet(CLUSTERS_PARQUET)
    print(f"Wrote {CLUSTERS_PARQUET}")

    # Save the 2D projection so the frontend can plot without recomputing.
    proj = df.assign(x=X2[:, 0], y=X2[:, 1], cluster_id=labels.astype(np.int32))
    proj[["patch_idx", "scan_name", "x", "y", "cluster_id", "group_nr"]].to_parquet(PROJECTION_PARQUET)
    print(f"Wrote {PROJECTION_PARQUET}")

    # ── Plot ───────────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(22, 7.5))

    # 1) K-means
    ax = axes[0]
    cmap = plt.get_cmap("tab20", n_clusters)
    for c in range(n_clusters):
        m = labels == c
        ax.scatter(X2[m, 0], X2[m, 1], s=5, alpha=0.7, c=[cmap(c)], label=f"{c} (n={m.sum()})")
    ax.set_title(f"K-means k={n_clusters} on 10D UMAP")
    ax.legend(loc="best", fontsize=6, ncols=2, markerscale=2)

    # 2) HDBSCAN (eom)
    ax = axes[1]
    cmap_h = plt.get_cmap("tab20", max(n_hdb, 1))
    noise_mask = hdb_labels == -1
    ax.scatter(X2[noise_mask, 0], X2[noise_mask, 1], s=3, alpha=0.25, c="#cccccc",
               label=f"noise ({noise_mask.sum()})")
    for c in range(n_hdb):
        m = hdb_labels == c
        ax.scatter(X2[m, 0], X2[m, 1], s=5, alpha=0.7, c=[cmap_h(c)], label=f"{c}")
    ax.set_title(f"HDBSCAN — {n_hdb} clusters, {noise_frac:.0%} noise")
    ax.legend(loc="best", fontsize=6, ncols=3, markerscale=2)

    # 3) By group — sanity check that clustering isn't a treatment artifact
    ax = axes[2]
    for g, color, lbl in [
        ("G001", "#1f77b4", "G001 Control"),
        ("G002", "#d62728", "G002 Semaglutide"),
    ]:
        m = (df["group_nr"] == g).values
        ax.scatter(X2[m, 0], X2[m, 1], s=4, alpha=0.5, c=color, label=f"{lbl} (n={m.sum()})")
    ax.set_title("Same layout, by group")
    ax.legend(loc="best", fontsize=9)

    for ax in axes:
        ax.set_xlabel("UMAP 1"); ax.set_ylabel("UMAP 2")
        ax.set_aspect("equal", adjustable="datalim")
    fig.suptitle(f"PLIP embedding clustering — {X.shape[0]} patches, 12 brains", fontsize=13)
    fig.tight_layout()
    fig.savefig(OUT_PLOT, dpi=130)
    print(f"Wrote {OUT_PLOT}")


if __name__ == "__main__":
    main()
