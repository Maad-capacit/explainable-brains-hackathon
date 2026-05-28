"""Runtime PLIP prompt-based clustering.

Encodes arbitrary text prompts with the PLIP text encoder and assigns every
patch (across all brains) to its best-matching prompt, mirroring the offline
scripts/text_cluster.py but computed on demand so prompts can be edited.

The model and the concatenated image-embedding matrix are loaded lazily and
cached; per-prompt text embeddings are memoized by prompt string so re-runs
only encode newly added prompts.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

import numpy as np

from . import data_access, embeddings

log = logging.getLogger(__name__)

PLIP_LOCAL = data_access.REPO_ROOT / "plip"
# Use the local PLIP weights if present; otherwise auto-download from the Hub
# (public, ~577 MB) so a fresh clone without the model dir still works.
PLIP_MODEL = str(PLIP_LOCAL) if (PLIP_LOCAL / "config.json").exists() else "vinid/plip"

_lock = threading.Lock()
_model = None
_proc = None
_prompt_cache: dict[str, np.ndarray] = {}

# Concatenated image embeddings across all brains + the per-row scan name.
_X_all: Optional[np.ndarray] = None
_scan_order: Optional[list[str]] = None  # scan name for each row of _X_all
_scan_counts: Optional[list[tuple[str, int]]] = None  # (scan, n_patches) in row order


def _ensure_model() -> None:
    global _model, _proc
    if _model is not None:
        return
    from transformers import CLIPModel, CLIPProcessor

    log.info("Loading PLIP model from %s…", PLIP_MODEL)
    _model = CLIPModel.from_pretrained(PLIP_MODEL)
    _proc = CLIPProcessor.from_pretrained(PLIP_MODEL)
    _model.eval()


def _encode_uncached(texts: list[str]) -> np.ndarray:
    import torch

    _ensure_model()
    assert _model is not None and _proc is not None
    with torch.no_grad():
        inputs = _proc(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
        # transformers 5.x: text_model returns pooled output; project manually.
        text_out = _model.text_model(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])
        feats = _model.text_projection(text_out.pooler_output).cpu().numpy()
    feats = feats / np.linalg.norm(feats, axis=-1, keepdims=True)
    return feats.astype(np.float32)


def encode_prompts(prompts: list[str]) -> np.ndarray:
    """Return (V, 512) L2-normalized PLIP text embeddings, memoized per prompt."""
    missing = [p for p in prompts if p not in _prompt_cache]
    if missing:
        # Deduplicate while preserving order so we encode each unique prompt once.
        uniq = list(dict.fromkeys(missing))
        feats = _encode_uncached(uniq)
        for prompt, vec in zip(uniq, feats):
            _prompt_cache[prompt] = vec
    return np.vstack([_prompt_cache[p] for p in prompts])


def _ensure_all_embeddings() -> None:
    global _X_all, _scan_order, _scan_counts
    if _X_all is not None:
        return
    mats: list[np.ndarray] = []
    order: list[str] = []
    counts: list[tuple[str, int]] = []
    all_brains = data_access.list_brains()
    for brain in all_brains:
        scan = brain["scan_name"]
        try:
            arr = embeddings.load(scan)
        except Exception as exc:
            log.warning("Skipping embeddings for %s (unavailable: %s)", scan, exc)
            continue
        mats.append(arr)
        order.extend([scan] * len(arr))
        counts.append((scan, len(arr)))
    if not mats:
        raise FileNotFoundError(
            "No patch embeddings are available for semantic clustering. "
            "Ensure embedding H5 files are present in data_cache/embeddings/ "
            "or the S3 bucket is accessible."
        )
    X = np.vstack(mats).astype(np.float32)
    norms = np.linalg.norm(X, axis=-1, keepdims=True)
    # PLIP embeddings should already be unit norm; normalize defensively.
    X = X / np.clip(norms, 1e-8, None)
    _X_all, _scan_order, _scan_counts = X, order, counts
    log.info(
        "Loaded %d patch embeddings across %d/%d brains for semantic clustering",
        len(X), len(counts), len(all_brains),
    )


def cluster(prompts: list[str]) -> tuple[list[str], dict[str, list[int]]]:
    """Assign every patch to its best-matching prompt.

    Returns (labels, assignments) where labels echoes the prompts and
    assignments[scan_name][patch_idx] is the winning prompt index.
    """
    if not prompts:
        raise ValueError("prompts must be non-empty")
    with _lock:
        _ensure_all_embeddings()
        assert _X_all is not None and _scan_counts is not None
        T = encode_prompts(prompts)  # (V, 512)
        sim = _X_all @ T.T  # (N, V) cosine sim (both L2-normalized)
        # Mean-center per prompt across all patches — calibrated zero-shot trick.
        sim = sim - sim.mean(axis=0, keepdims=True)
        top1 = np.argmax(sim, axis=1).astype(int)

        assignments: dict[str, list[int]] = {}
        offset = 0
        for scan, n in _scan_counts:
            assignments[scan] = top1[offset : offset + n].tolist()
            offset += n
    return list(prompts), assignments
