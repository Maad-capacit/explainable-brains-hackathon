---
name: brain-bucket-access
description: Access 3D mouse brain scan data from the hackathon's Hetzner S3 bucket. Use when listing, downloading, or reading remote brain data — patches, embeddings, raw whole-brain H5 volumes, c-Fos quantification CSVs, or NIfTI atlas/signal maps under `challengeA/` or `challengeB/`.
---

# Brain Bucket Access

Read-only access to the hackathon's Hetzner S3 bucket containing 3D light-sheet
microscopy data of mouse brains (c-Fos marker, Vehicle vs Semaglutide).

All access goes through `bucket_access/bucket_utils.py`. Credentials are
preconfigured in `bucket_access/config.py` — do not hardcode or re-create clients.

## Bucket layout

```
bucket/
├── challengeA/
│   ├── patches/                {scan_name}_patches.h5         (~50 MB each, 12 brains)
│   │   └── all_patches_metadata.csv                           (combined metadata)
│   ├── embeddings/             {scan_name}_embeddings.h5      (~2 MB each, PLIP, L2-normalized)
│   └── raw_whole_brain_data/   {scan_name}.h5                 (~5 GB each — DO NOT download)
└── challengeB/
    ├── tabular_data_quantification/
    │   ├── cfos_object_density_quantification.csv             (per-animal × region densities)
    │   └── cfos_object_density_statistics_G002_vs_G001.csv    (group comparison stats)
    └── spatial_brain_maps/
        ├── brain_atlas_anatomy.nii.gz
        ├── brain_atlas_regions.nii.gz                         (integer labels per voxel)
        ├── cfos_G001_median.nii.gz                            (Vehicle median signal)
        ├── cfos_G002_median.nii.gz                            (Semaglutide median signal)
        ├── cfos_group_median_difference_G002_vs_G001.nii.gz
        └── atlas_hierarchy.csv                                (label → region name)
```

Conditions: `G001` = Vehicle (control), `G002` = Semaglutide.
Voxel size: 5×5×5 µm. Raw volume shape ≈ `(Z, Y, X) = (1498, 2878, 2000)` uint16.

## Functions cheat sheet

Import from `bucket_access.bucket_utils`:

| Function | Use for | Returns |
|----------|---------|---------|
| `list_files(prefix)` | List S3 keys under a prefix | `list[str]` |
| `download_file(s3_key, local_path)` | Download any single file (CSV, NIfTI, etc.) | `None` |
| `read_h5_patches(s3_key)` | Load a `_patches.h5` directly from bucket | `(patches, metadata, attrs)` |
| `read_h5_embeddings(s3_key)` | Load an `_embeddings.h5` directly from bucket | `(embeddings, attrs)` |
| `get_h5_info_remote(s3_key)` | Inspect raw brain H5 shape/dtype without downloading | `dict` |
| `read_h5_slice_remote(s3_key, z_range, y_range, x_range)` | Read a subregion of a raw brain volume | `np.ndarray` |

Shapes:
- `patches`: `(N, 256, 256)` uint16, `metadata`: pandas DataFrame, one row per patch
- `embeddings`: `(N, 512)` float32, L2-normalized — cosine similarity = dot product
- Patch index `i` in `patches.h5` aligns exactly with row `i` in `embeddings.h5`

## Quick start

```python
from bucket_access.bucket_utils import (
    list_files, download_file,
    read_h5_patches, read_h5_embeddings,
    get_h5_info_remote, read_h5_slice_remote,
)

list_files('challengeA/patches/')
list_files('challengeB/')
```

## Common workflows

### Load all Challenge A patches + embeddings

```python
import numpy as np
import pandas as pd

patches_all, meta_all, emb_all = [], [], []

for key in sorted(list_files('challengeA/patches/')):
    if not key.endswith('_patches.h5'):
        continue
    patches, meta, attrs = read_h5_patches(key)
    meta['scan_name'] = attrs['scan_name']
    meta['condition'] = attrs['condition']
    patches_all.append(patches)
    meta_all.append(meta)

    emb_key = key.replace('/patches/', '/embeddings/').replace('_patches.h5', '_embeddings.h5')
    emb, _ = read_h5_embeddings(emb_key)
    emb_all.append(emb)

patches_all = np.vstack(patches_all)        # (~7500, 256, 256) uint16
meta_all    = pd.concat(meta_all, ignore_index=True)
emb_all     = np.vstack(emb_all)            # (~7500, 512) float32
```

### Read a slice from a raw brain volume (do NOT download the full file)

```python
key = 'challengeA/raw_whole_brain_data/260219_AN0B7_G002_mouse_brain_MB1_SCAN0_16-11-05.h5'

info = get_h5_info_remote(key)              # {'shape': (Z, Y, X), 'dtype': 'uint16', 'size_gb': ~5.0, ...}
mid_z = info['shape'][0] // 2

slab = read_h5_slice_remote(key, z_range=(mid_z, mid_z + 1))   # single Z slice
roi  = read_h5_slice_remote(key, z_range=(400, 600), y_range=(1000, 1500), x_range=(800, 1300))
```

### Challenge B — load tabular quantification + statistics

```python
import pandas as pd

download_file('challengeB/tabular_data_quantification/cfos_object_density_quantification.csv', 'cfos_quant.csv')
download_file('challengeB/tabular_data_quantification/cfos_object_density_statistics_G002_vs_G001.csv', 'cfos_stats.csv')

df    = pd.read_csv('cfos_quant.csv')        # rows = animals, cols = scan_name, animal_nr, group_nr, <region acronyms...>
stats = pd.read_csv('cfos_stats.csv')        # one row per region, with log2_fold_change, p_corrected, etc.

sig = stats[stats['significant_corrected']].sort_values('p_corrected')
```

### Challenge B — load NIfTI spatial maps

```python
import SimpleITK as sitk
import numpy as np
import pandas as pd

for fname in [
    'brain_atlas_anatomy.nii.gz',
    'brain_atlas_regions.nii.gz',
    'cfos_G001_median.nii.gz',
    'cfos_G002_median.nii.gz',
    'cfos_group_median_difference_G002_vs_G001.nii.gz',
    'atlas_hierarchy.csv',
]:
    download_file(f'challengeB/spatial_brain_maps/{fname}', fname)

anatomy   = sitk.GetArrayFromImage(sitk.ReadImage('brain_atlas_anatomy.nii.gz'))     # (Z, Y, X)
regions   = sitk.GetArrayFromImage(sitk.ReadImage('brain_atlas_regions.nii.gz')).astype(int)
diff_map  = sitk.GetArrayFromImage(sitk.ReadImage('cfos_group_median_difference_G002_vs_G001.nii.gz'))
hierarchy = pd.read_csv('atlas_hierarchy.csv')

label_id    = hierarchy.loc[hierarchy['acronym'] == 'PVT', 'label'].iloc[0]
region_mask = regions == label_id
```

## Important rules

- **Never download `challengeA/raw_whole_brain_data/` files in full** — each is ~5 GB.
  Use `get_h5_info_remote` and `read_h5_slice_remote` for any inspection.
- `read_h5_patches` loads the full file into memory (~50 MB) — fine per-file, but stream
  brain-by-brain rather than concatenating in memory only when needed.
- Embeddings are already L2-normalized, so cosine similarity is just `a @ b`.
- Patch index alignment is implicit — same `i` in patches and embeddings refers to the
  same patch. Don't rebuild a join key.
- Bucket access is read-only by design. Do not attempt `put_object` / `upload_file`.
- Treat `bucket_access/config.py` credentials as hackathon-scoped — don't print them,
  don't commit changes to that file, don't ship them outside this repo.

## When to look elsewhere

- Detailed per-field schema for patches metadata and statistics CSV columns:
  `CHALLENGE_A.md` and `CHALLENGE_B.md` in the repo root.
- Source of truth for available functions and signatures:
  `bucket_access/bucket_utils.py`.
