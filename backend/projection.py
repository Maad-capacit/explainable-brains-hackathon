"""Load UMAP projection + cluster labels from data_cache/cluster_artifacts/."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Optional

import pandas as pd

from .data_access import REPO_ROOT

log = logging.getLogger(__name__)

PROJECTION_PARQUET = REPO_ROOT / "data_cache" / "cluster_artifacts" / "projection.parquet"

_df: Optional[pd.DataFrame] = None
_records: Optional[list[dict]] = None
_lock = threading.Lock()


def load() -> pd.DataFrame:
    global _df, _records
    with _lock:
        if _df is None:
            if not PROJECTION_PARQUET.exists():
                raise FileNotFoundError(
                    f"{PROJECTION_PARQUET} not found — run scripts/umap_cluster.py first"
                )
            _df = pd.read_parquet(PROJECTION_PARQUET)
            # Pre-serialize to records once; the endpoint just returns this.
            _records = _df.to_dict(orient="records")
            log.info("Loaded projection: %d points, %d clusters", len(_df), _df["cluster_id"].nunique())
        return _df


def records() -> list[dict]:
    load()
    assert _records is not None
    return _records
