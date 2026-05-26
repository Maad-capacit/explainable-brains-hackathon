"""Load UMAP projection + cluster labels from data_cache/cluster_artifacts/."""

from __future__ import annotations

import json
import logging
import random
import threading
from typing import Optional

import numpy as np
import pandas as pd

from .data_access import REPO_ROOT

log = logging.getLogger(__name__)

CLUSTER_DIR = REPO_ROOT / "data_cache" / "cluster_artifacts"
PROJECTION_PARQUET = CLUSTER_DIR / "projection.parquet"
TEXT_CLUSTERS_PARQUET = CLUSTER_DIR / "text_clusters.parquet"
TEXT_LABELS_JSON = CLUSTER_DIR / "text_labels.json"

GROUP_TO_CONDITION = {"G001": "Control", "G002": "Semaglutide"}

_text_labels: Optional[list[str]] = None

_df: Optional[pd.DataFrame] = None
_records: Optional[list[dict]] = None
_lock = threading.Lock()


def load() -> pd.DataFrame:
    global _df, _records, _text_labels
    with _lock:
        if _df is None:
            if not PROJECTION_PARQUET.exists():
                raise FileNotFoundError(
                    f"{PROJECTION_PARQUET} not found — run scripts/umap_cluster.py first"
                )
            df = pd.read_parquet(PROJECTION_PARQUET)
            df["condition"] = df["group_nr"].map(GROUP_TO_CONDITION).fillna("Unknown")

            # Merge optional text-cluster assignments.
            if TEXT_CLUSTERS_PARQUET.exists():
                tc = pd.read_parquet(TEXT_CLUSTERS_PARQUET)[
                    ["scan_name", "patch_idx", "text_cluster_id", "score"]
                ]
                df = df.merge(tc, on=["scan_name", "patch_idx"], how="left")
                df["text_cluster_id"] = df["text_cluster_id"].fillna(-1).astype(int)
            else:
                df["text_cluster_id"] = -1

            if TEXT_LABELS_JSON.exists():
                with TEXT_LABELS_JSON.open() as fp:
                    _text_labels = json.load(fp)
            else:
                _text_labels = []

            _df = df
            _records = _df.to_dict(orient="records")
            log.info(
                "Loaded projection: %d points, %d kmeans clusters, %d text labels",
                len(_df), _df["cluster_id"].nunique(), len(_text_labels or []),
            )
        return _df


def text_labels() -> list[str]:
    load()
    return list(_text_labels or [])


def records() -> list[dict]:
    load()
    assert _records is not None
    return _records


def _row_to_dict(row: pd.Series) -> dict:
    return {
        "patch_idx": int(row["patch_idx"]),
        "scan_name": str(row["scan_name"]),
        "x": float(row["x"]),
        "y": float(row["y"]),
        "cluster_id": int(row["cluster_id"]),
        "group_nr": str(row["group_nr"]),
        "condition": str(row["condition"]),
    }


def random_record(rng: Optional[random.Random] = None) -> dict:
    df = load()
    r = rng or random
    i = r.randrange(len(df))
    return _row_to_dict(df.iloc[i])


def find_record(scan_name: str, patch_idx: int) -> dict:
    df = load()
    sub = df[(df["scan_name"] == scan_name) & (df["patch_idx"] == patch_idx)]
    if sub.empty:
        raise KeyError(f"no projection point for {scan_name} patch {patch_idx}")
    return _row_to_dict(sub.iloc[0])


def nearest_opposite(source: dict) -> dict:
    """Find the nearest point in UMAP space whose group differs from `source`."""
    df = load()
    opposite = df[df["group_nr"] != source["group_nr"]]
    if opposite.empty:
        raise ValueError(f"no opposite-group points to {source['group_nr']}")
    dx = opposite["x"].to_numpy() - source["x"]
    dy = opposite["y"].to_numpy() - source["y"]
    dists = np.hypot(dx, dy)
    i = int(np.argmin(dists))
    row = opposite.iloc[i]
    out = _row_to_dict(row)
    out["distance"] = float(dists[i])
    return out
