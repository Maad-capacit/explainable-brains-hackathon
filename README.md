# Explainable Brains — Hackathon Submission

[Watch the demo](https://github.com/user-attachments/assets/28abc5b0-27e7-4e0c-b2df-efcbc24ccffe)



---

## Table of Contents

1. [The Challenge](#the-challenge)
2. [Our Solution](#our-solution)
3. [How to Run](#how-to-run)
4. [Future Work](#future-work)
5. [Tech Stack](#tech-stack)

---

## The Challenge

Built at the **Explainable Brains Hackathon** (Copenhagen, May 26, 2026) — **Challenge A: Smart image data selection for generalizable AI models**.

Mouse brains imaged with 3D light-sheet microscopy (5×5×5 µm resolution) and stained with a c-Fos marker (proxy for neuronal activation) produce thousands of 256×256 image patches per scan. Two experimental conditions are compared — **Vehicle / control (G001)** vs. **Semaglutide / Ozempic (G002)** — across 12 brains (~7,500 patches total).

The bottleneck in training AI models on brain imaging data is not compute — it is **data selection**. Ground-truth labels are produced by time-intensive semi-manual processes. Choosing *which* patches to label is critical: a small, well-curated dataset consistently outperforms a large, noisy one for model generalizability.

**The goal:** automatically characterize signal diversity across patches and surface the most informative subset for human labeling and model training.

---

## Our Solution

We built a **full-stack interactive web application** that guides researchers through a structured three-phase workflow:

**Phase 1 — Explore**
Browse all 12 brain scans and their patches with per-patch quality metrics (sharpness, SNR, signal fraction, foreground fraction). Patches are displayed in a virtualized thumbnail grid and linked to their 3D location in brain space via an interactive scatter plot.

**Phase 2 — Review clusters**
Run browser-side k-means clustering on [PLIP](https://github.com/PathologyFoundation/plip) embeddings (512-dimensional, L2-normalized cosine) to partition patches into semantically meaningful groups. Clusters are presented as labeled folders — select any cluster to inspect its patches side by side.

**Cluster with prompts**
A second clustering algorithm is available — *semantic prompt clustering*, where each cluster is defined by a free-form text phrase. When you press **Run clustering**, the backend encodes every prompt with the PLIP text encoder and compares it to every patch embedding; each patch is assigned to the prompt with the highest cosine similarity score. 24 pre-written prompts (cell density, tissue framing, anatomy, imaging quality) ship as a starting point — edit, remove, or add your own. Hovering a point on the UMAP grid shows both the matched prompt name and its similarity score, so weakly assigned patches stand out at a glance.

**Validate with UMAP**
A two-stage UMAP projection (512D → 10D for clustering, 512D → 2D for visualization) is pre-computed offline and served by the backend. The 2D projection is displayed alongside k-means coloring, giving researchers a visual sanity check of cluster quality across the full dataset or per brain. A secondary **text-vocabulary view** uses PLIP zero-shot matching against 24 biological phrases to semantically annotate patches without any manual labeling.

**Phase 3 — Label** *(stub, see [Future Work](#future-work))*
Placeholder for the human-in-the-loop labeling step.

---

## How to Run

See the individual READMEs for full details:

- **[backend/README.md](backend/README.md)** — FastAPI server, endpoints, environment variables
- **[frontend/README.md](frontend/README.md)** — React dev server, scripts, component structure

### Quick start

```bash
# 1. Install Python dependencies (from repo root)
conda env create -f environment.yml && conda activate explainable-brains
# or: pip install -r requirements.txt

# 2. Start the backend (from repo root)
uvicorn backend.main:app --reload --port 8000

# 3. In a second terminal, start the frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

> **First run:** H5 patch files (~50 MB each) are downloaded from the Hetzner S3 bucket on first access and cached in `data_cache/`. Subsequent starts are fast.

---

## Future Work

Given more time, we would have liked to:

**More clustering models** — Add HDBSCAN, spectral clustering, and Gaussian Mixture Models as selectable algorithms alongside k-means, allowing researchers to compare clustering strategies and choose the one that best fits each dataset's topology.

**Natural language patch explanations** — Expand the text-vocabulary module to generate rich, per-patch natural language descriptions for each cluster's visual and biological characteristics. These summaries would appear directly inside the cluster folder view and the patch detail modal, making it easier for non-specialists to interpret what each cluster represents biologically.

**Per-cluster natural language summaries** — For every cluster the user computes, generate a short natural language description that captures what visual or biological pattern the cluster is essentially "grabbing". The summary would surface in the cluster folder header, so a reviewer can understand what a cluster represents at a glance without opening every thumbnail.

**A "leftover" cluster for unmatched patches** — Prompt-based clustering currently forces every patch into the best-matching prompt, even when the similarity score is weak. Add an explicit "leftover" cluster gated by a configurable similarity threshold: patches whose top score falls below the cutoff land there, surfacing what the current prompt set does *not* describe well and flagging good candidates for new prompts.

**Complete the labeling step (Phase 3)** — Build out the human-in-the-loop labeling interface currently stubbed as Phase 3. Annotators would assign ground-truth labels to representative patches from each cluster, propagate labels within clusters, review edge cases, and export a curated labeled dataset ready for model training.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand, Plotly.js |
| Backend | FastAPI, uvicorn, h5py, numpy, pandas, Pillow |
| ML / Embeddings | PLIP (512D), UMAP (offline), k-means (browser-side via ml-kmeans) |
| Data | Hetzner S3 bucket, H5 patch files, Parquet projection/cluster artifacts |
| Visualization | Plotly WebGL (3D scatter, 2D UMAP), react-window (virtualized grid) |
