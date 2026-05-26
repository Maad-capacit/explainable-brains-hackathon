"""Benchmark PLIP image encoding on 256x256 uint16 patches (the Challenge A format)."""
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_DIR = Path(__file__).parent / "plip"
N_TOTAL = 7500
BATCH_SIZES = [1, 8, 16, 32, 64]
WARMUP_BATCHES = 2


def make_patches(n: int, seed: int = 0) -> list[Image.Image]:
    rng = np.random.default_rng(seed)
    arr = rng.integers(0, 65535, size=(n, 256, 256), dtype=np.uint16)
    arr8 = (arr >> 8).astype(np.uint8)
    return [Image.fromarray(a).convert("RGB") for a in arr8]


def main() -> None:
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device: {device}")

    model = CLIPModel.from_pretrained(str(MODEL_DIR)).eval().to(device)
    processor = CLIPProcessor.from_pretrained(str(MODEL_DIR))

    n_bench = 256
    patches = make_patches(n_bench)
    print(f"Built {n_bench} synthetic 256x256 patches\n")

    def sync() -> None:
        if device == "cuda":
            torch.cuda.synchronize()
        elif device == "mps":
            torch.mps.synchronize()

    print(f"{'batch':>6}  {'preproc/img(ms)':>16}  {'gpu/img(ms)':>13}  {'total/img(ms)':>14}  {'imgs/sec':>10}  {'est 7500 (s)':>13}")
    for bs in BATCH_SIZES:
        for _ in range(WARMUP_BATCHES):
            batch = patches[:bs]
            inputs = processor(images=batch, return_tensors="pt").to(device)
            with torch.no_grad():
                model.get_image_features(**inputs)
            sync()

        t_pre = 0.0
        t_gpu = 0.0
        n_done = 0
        i = 0
        while i + bs <= n_bench:
            batch = patches[i : i + bs]

            t0 = time.perf_counter()
            inputs = processor(images=batch, return_tensors="pt").to(device)
            sync()
            t1 = time.perf_counter()

            with torch.no_grad():
                model.get_image_features(**inputs)
            sync()
            t2 = time.perf_counter()

            t_pre += t1 - t0
            t_gpu += t2 - t1
            n_done += bs
            i += bs

        pre_ms = 1000 * t_pre / n_done
        gpu_ms = 1000 * t_gpu / n_done
        total_ms = pre_ms + gpu_ms
        ips = 1000 / total_ms
        eta = N_TOTAL / ips
        print(f"{bs:>6d}  {pre_ms:>16.2f}  {gpu_ms:>13.2f}  {total_ms:>14.2f}  {ips:>10.1f}  {eta:>13.1f}")


if __name__ == "__main__":
    main()
