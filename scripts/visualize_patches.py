"""Show a grid of random patches from a Challenge A h5 file."""
from pathlib import Path
import argparse
import h5py
import numpy as np
import matplotlib.pyplot as plt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--h5", default="data/challengeA/patches/260219_AN0B2_G002_mouse_brain_MB1_SCAN0_11-56-32_patches.h5")
    ap.add_argument("--n", type=int, default=16)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="scripts/patches_preview.png")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    with h5py.File(args.h5, "r") as f:
        patches = f["patches"]
        meta = f["metadata"][:]
        n_total = patches.shape[0]
        idx = np.sort(rng.choice(n_total, size=min(args.n, n_total), replace=False))
        imgs = patches[idx]
        scan = f.attrs.get("scan_name", Path(args.h5).stem)

    cols = int(np.ceil(np.sqrt(len(imgs))))
    rows = int(np.ceil(len(imgs) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(2.2 * cols, 2.2 * rows))
    axes = np.atleast_1d(axes).ravel()

    for ax, img, i in zip(axes, imgs, idx):
        lo, hi = np.percentile(img, [1, 99])
        ax.imshow(img, cmap="gray", vmin=lo, vmax=max(hi, lo + 1))
        m = meta[i]
        ax.set_title(f"#{i}  z={m['z0']} sig={m['fraction_signal']:.2f}", fontsize=7)
        ax.set_xticks([]); ax.set_yticks([])
    for ax in axes[len(imgs):]:
        ax.axis("off")

    fig.suptitle(scan, fontsize=9)
    fig.tight_layout()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=120)
    print(f"wrote {out}  ({len(imgs)} patches from {n_total})")


if __name__ == "__main__":
    main()
