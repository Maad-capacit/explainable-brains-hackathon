"""Text-based clustering of patches by similarity to PLIP-encoded vocabulary phrases.

For each patch, find the vocab phrase whose PLIP text embedding has the highest
cosine similarity with the patch's PLIP image embedding. Assign that as cluster.

Writes:
  data_cache/cluster_artifacts/text_clusters.parquet
    (patch_idx, scan_name, text_cluster_id, score, score_2nd, top2_cluster_id)
  data_cache/cluster_artifacts/text_labels.json
    [phrase, phrase, ...] indexed by text_cluster_id
"""

from __future__ import annotations

import json
from pathlib import Path

import h5py
import numpy as np
import pandas as pd
from transformers import CLIPModel, CLIPProcessor
import torch

REPO = Path(__file__).resolve().parent.parent
EMB_DIR = REPO / "data" / "challengeA" / "embeddings"
PLIP_LOCAL = REPO / "plip"
ARTIFACTS = REPO / "data_cache" / "cluster_artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
OUT_PARQUET = ARTIFACTS / "text_clusters.parquet"
OUT_LABELS = ARTIFACTS / "text_labels.json"

VOCAB = [
    # Cell density
    "densely packed bright cell nuclei",
    "moderate density of fluorescent cells on tissue",
    "sparse scattered fluorescent cells",
    "tissue with very few visible cells",
    # Tissue framing
    "curved edge of a tissue section against dark background",
    "small wedge of tissue in the corner of a black image",
    "tissue filling the whole frame with no edges",
    "thin strip of tissue surrounded by dark background",
    "empty dark region with no tissue",
    # Anatomy / structure
    "tissue with horizontal banded layers",
    "cortical-like parallel cell bands",
    "tissue with a dark elongated blood vessel",
    "tissue with a small dark vascular cross-section",
    "tissue with a large dark tear or cavity",
    # Imaging quality
    "blurry out-of-focus image with diffuse signal",
    "sharp in-focus image with clearly resolved cell bodies",
    "image with horizontal scan-line striping artifacts",
    # Combined / specific
    "dense neural tissue with many c-Fos positive cells",
    "low-signal tissue with diffuse autofluorescence",
    "gradient from dense to sparse cells",
    "uniform tissue with even bright cell distribution",
    "tissue boundary with cells clustered along the edge",
    "brain tissue with a ventricle or cavity",
    "mottled tissue with sparse bright spots",
]


def load_image_embeddings() -> tuple[np.ndarray, pd.DataFrame]:
    """Concatenate all PLIP image embeddings across brains, return + index df."""
    embs, scans, idxs = [], [], []
    for f in sorted(EMB_DIR.glob("*_embeddings.h5")):
        scan = f.name.replace("_embeddings.h5", "")
        with h5py.File(f, "r") as h:
            arr = h["embeddings"][...]
        embs.append(arr)
        scans.extend([scan] * len(arr))
        idxs.extend(range(len(arr)))
    return np.vstack(embs), pd.DataFrame({"scan_name": scans, "patch_idx": idxs})


def encode_vocab(texts: list[str]) -> np.ndarray:
    """Encode vocab with PLIP text encoder, L2-normalized."""
    print(f"Loading PLIP model from {PLIP_LOCAL}…")
    model = CLIPModel.from_pretrained(str(PLIP_LOCAL))
    proc = CLIPProcessor.from_pretrained(str(PLIP_LOCAL))
    model.eval()
    with torch.no_grad():
        inputs = proc(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
        # transformers 5.x get_text_features returns a BaseModelOutputWithPooling,
        # not a tensor — recreate the projection manually.
        text_out = model.text_model(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])
        text_embeds = model.text_projection(text_out.pooler_output)
        feats = text_embeds.cpu().numpy()
    # L2 normalize so dot product == cosine similarity
    feats = feats / np.linalg.norm(feats, axis=-1, keepdims=True)
    print(f"  encoded {feats.shape[0]} phrases → {feats.shape[1]}-dim")
    return feats


def main():
    print("Loading image embeddings…")
    X, df = load_image_embeddings()
    print(f"  X: {X.shape}, brains: {df['scan_name'].nunique()}")

    # PLIP image embeddings should already be L2-normalized per the README, but verify.
    norms = np.linalg.norm(X, axis=-1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        print(f"  re-normalizing (norms in [{norms.min():.3f}, {norms.max():.3f}])")
        X = X / norms[:, None]

    T = encode_vocab(VOCAB)  # (V, 512) L2-normalized

    print("Computing similarities…")
    sim_raw = X @ T.T  # (N, V), cosine sim since both are L2-normalized
    print(f"  raw sim range: [{sim_raw.min():.3f}, {sim_raw.max():.3f}]")

    # Mean-center per-phrase across the dataset — removes the per-phrase bias so
    # phrases compete on relative match strength rather than absolute prior.
    # Standard trick for unbalanced CLIP zero-shot ("calibrated prompts").
    sim = sim_raw - sim_raw.mean(axis=0, keepdims=True)
    print(f"  centered sim range: [{sim.min():.3f}, {sim.max():.3f}]")

    # Top-1 and top-2 per patch.
    top2 = np.argsort(-sim, axis=1)[:, :2]
    top1 = top2[:, 0]
    second = top2[:, 1]
    score = sim[np.arange(len(sim)), top1]
    score_2nd = sim[np.arange(len(sim)), second]
    margin = score - score_2nd

    out = df.assign(
        text_cluster_id=top1.astype(np.int32),
        score=score.astype(np.float32),
        score_2nd=score_2nd.astype(np.float32),
        margin=margin.astype(np.float32),
        top2_cluster_id=second.astype(np.int32),
    )
    out.to_parquet(OUT_PARQUET)
    print(f"Wrote {OUT_PARQUET}")

    with OUT_LABELS.open("w") as f:
        json.dump(VOCAB, f, indent=2)
    print(f"Wrote {OUT_LABELS}")

    # Summary.
    counts = pd.Series(top1).value_counts().sort_index()
    print("\nCluster sizes:")
    for i, phrase in enumerate(VOCAB):
        n = counts.get(i, 0)
        bar = "█" * int(40 * n / counts.max()) if counts.max() else ""
        print(f"  {i:>2} [{n:>5}] {bar}  {phrase[:60]}…")


if __name__ == "__main__":
    main()
