"""Download all Challenge A patches + embeddings + metadata CSV into ./data/challengeA/.

Run from repo root:  uv run python scripts/download_challengeA.py
"""

from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bucket_access.bucket_utils import download_file, list_files  # noqa: E402

DEST = ROOT / "data" / "challengeA"


def to_download() -> list[tuple[str, Path]]:
    jobs: list[tuple[str, Path]] = []
    for prefix in ("challengeA/patches/", "challengeA/embeddings/"):
        for key in list_files(prefix):
            if key.endswith("/"):
                continue
            local = DEST / key[len("challengeA/") :]
            jobs.append((key, local))
    return jobs


def fetch(key: str, local: Path) -> tuple[str, int, float]:
    local.parent.mkdir(parents=True, exist_ok=True)
    if local.exists() and local.stat().st_size > 0:
        return key, local.stat().st_size, 0.0
    t0 = time.time()
    download_file(key, str(local))
    return key, local.stat().st_size, time.time() - t0


def main() -> int:
    jobs = to_download()
    print(f"Found {len(jobs)} files to consider under challengeA/")
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(fetch, key, local) for key, local in jobs]
        for fut in as_completed(futures):
            key, size, dt = fut.result()
            total_bytes += size
            tag = "cached" if dt == 0.0 else f"{dt:5.1f}s"
            print(f"  [{tag}] {size / 1e6:7.1f} MB  {key}")
    print(f"\nDone. {total_bytes / 1e6:.1f} MB total under {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
