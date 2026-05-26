# Explainable Brains Hackathon

## Overview

3D light-sheet microscopy scans of mouse brains, imaged at 5×5×5 µm resolution with
a c-Fos marker (proxy for neuronal activation). Two conditions: **Vehicle (G001)**
vs **Semaglutide / Ozempic (G002)**. Goal: make complex brain imaging data accessible,
interpretable, and actionable using AI.

Data lives in a remote S3 bucket — see [bucket_access/bucket_utils.py](bucket_access/bucket_utils.py).

---

## Table of Contents

1. [Claude Code Skills](#claude-code-skills)
2. [Challenge A — Smart image data selection](#challenge-a--smart-image-data-selection-for-generalizable-ai-models)
3. [Challenge B — Guided brain data exploration](#challenge-b--guided-brain-data-exploration-for-biological-insight)
4. [Setup](#setup)
5. [Claude Code setup](#claude-code-setup)
6. [LightningAI Studio](#lightningai-studio)
7. [About the hackathon](#about-the-hackathon)

---

## Claude Code Skills

Skills are located in `.claude/skills/` and are automatically loaded by Claude Code.

| Skill | Triggers | File |
|-------|----------|------|
| `brain-bucket-access` | listing/reading/downloading bucket data, patches, embeddings, NIfTI, CSVs | [.claude/skills/brain-bucket-access/SKILL.md](.claude/skills/brain-bucket-access/SKILL.md) |

---

## Challenge A — Smart image data selection for generalizable AI models

Training AI models for brain imaging is not bottlenecked by compute — it is bottlenecked
by data selection. A smaller, well-curated dataset often outperforms a large, noisy one.
Reliable ground truth labels are generated through time-intensive semi-manual processes,
so choosing *which* patches to label matters enormously.

The challenge is to automatically identify the most informative signal patterns that
represent the diversity of the dataset, enabling models to generalize well while
minimizing the need for manual labeling.

*Standard laptop should be sufficient. GPU useful only if you want to run custom models: see [LightningAI](#lightningai-studio) below.*

**→ [Challenge A — solution, data, and quick start](CHALLENGE_A.md)**

**→ [Mouse Brain Patch Viewer — runnable web app for Challenge A](VIEWER.md)**


## Challenge B — Guided brain data exploration for biological insight

Brain scans go through signal extraction and quantification in Vibraint's analysis
pipeline. The final output is rich but complex: spreadsheets summarizing quantified
signal per brain region and sample, statistical comparisons between groups, and spatial
brain maps. This data is difficult to visualize intuitively, hard to navigate, and
challenging to interpret without specialist tools.

*Works on any laptop. No GPU needed.*

**→ [Challenge B — solution, data, and quick start](CHALLENGE_B.md)**

---

## Setup

### 1. Fork and clone the repo

First, click **Fork** at the top right of this page to copy the repo to your GitHub account.  
Then, clone your fork:
```bash
git clone https://github.com/explainable-brains/explainable-brains-hackathon.git
cd explainable-brains-hackathon
```

### 2. Create the environment

With conda:
```bash
conda env create -f environment.yml
conda activate explainable-brains
```

With pip:
```bash
pip install -r requirements.txt
```

### 3. Bucket access

Data lives in a cloud bucket. Credentials are in `bucket_access/config.py` — already
in the repo for the duration of the hackathon.

```python
from bucket_access.bucket_utils import list_files, download_file, read_h5_patches

# see what's in the bucket
list_files('challengeA/')
list_files('challengeB/')
```

See [bucket_access/bucket_utils.py](bucket_access/bucket_utils.py) for all available functions.

### 4. Set up Claude Code. See instructions below.

### 5. Work on the challenge. Submit your work

Push your code to your fork before demos start at 18:55:

```bash
git add .
git commit -m "hackathon submission, team X"
git push
```

Share your fork URL when you demo so the judges and other teams can see what you built.

---

## Claude Code setup

Claude Code is an AI coding assistant that runs in your terminal and reads, writes,
and executes code across your whole project.

### Option A — Anthropic API credits (no subscription needed)

Anthropic is providing **$20 in API credits** per participant.

1. Claim your credits at **[appliedfutures.io/hackathons/explainable-brains](https://appliedfutures.io/hackathons/explainable-brains)**
   *(link goes live at 16:00 — use your Organization ID from console.anthropic.com, not your claude.ai user ID)*

2. Install Claude Code:

   **Mac / Linux:**
   <pre>curl -fsSL https://claude.ai/install.sh | bash</pre>

    **Windows (PowerShell):**
```bash
   winget install Anthropic.ClaudeCode
```
   Requires [Git for Windows](https://git-scm.com/downloads/win) — install that first if you don't have it.

3. Set your API key:

   **Linux:**
   <pre>echo "export ANTHROPIC_API_KEY=sk-ant-..." >> ~/.bashrc
   source ~/.bashrc</pre>

   **Mac:**
   <pre>echo "export ANTHROPIC_API_KEY=sk-ant-..." >> ~/.zshrc
   source ~/.zshrc</pre>
   
   **Windows (Git Bash):**
   <pre>export ANTHROPIC_API_KEY=sk-ant-...</pre>

   **Windows (UI):**
   Search "environment variables" in the Start menu → Edit environment variables for your account → New → Name: `ANTHROPIC_API_KEY`, Value: your key → restart Git Bash

3. Run:
```bash
   claude
```

### Option B — Already have Claude Code running with a subscription
You can use the hackathon API credits instead of your subscription.

1. Claim your credits at **[appliedfutures.io/hackathons/explainable-brains](https://appliedfutures.io/hackathons/explainable-brains)**
   *(use your Organization ID from console.anthropic.com)*

2. Log out first to avoid conflicts between your subscription and the API key:
```bash
   claude /logout
```

3. Start Claude and authenticate with your Console account:
```bash
   claude
```
   Select **option 2 — Anthropic Console account** → follow the browser link → log in at console.anthropic.com

**No browser access?** Set the API key manually instead of step 3:

   **Mac:**
   <pre>echo "export ANTHROPIC_API_KEY=sk-ant-..." >> ~/.zshrc && source ~/.zshrc</pre>
   
   **Linux:**
   <pre>echo "export ANTHROPIC_API_KEY=sk-ant-..." >> ~/.bashrc && source ~/.bashrc</pre>
   
   **Windows — Git Bash:**
   <pre>export ANTHROPIC_API_KEY=sk-ant-...</pre>
   
   **Windows — UI:**
   Search "environment variables" in the Start menu → Edit environment variables for your account → New → add `ANTHROPIC_API_KEY` and your key value → restart your terminal

   Then run `claude`, select **option 2** and say **Yes** to use the API key.

---

## LightningAI Studio

If you need more compute for Challenge A — more CPU, RAM, or GPU for custom model work.

1. Go to [lightning.ai](https://lightning.ai) and create a free account
2. Create a new Studio — Python template
3. Clone the repo and install any missing packages into the existing environment:
```bash
git clone https://github.com/explainable-brains/explainable-brains-hackathon.git
cd explainable-brains-hackathon
```
4. Set up Claude Code:
- Add your Anthropic API key as a secret: go to lightning.ai → Settings → Secrets
- Create a secret named ANTHROPIC_API_KEY with your key from console.anthropic.com
- Restart the Studio so the secret is injected
- Install Claude Code
  
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

- Start Claude Code via
```bash
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY claude
```
or
```bash
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE claude
```

---

## About the hackathon

**Copenhagen · Tuesday May 26th, 2026 · 16:00–20:00**  
*From signals to understanding — a 4-hour sprint to make complex brain imaging data accessible, interpretable, and actionable.*

Neurological and mental health conditions are among the most widespread and least solved
problems in medicine. Vibraint ApS ([vibraint.dk](https://vibraint.dk)) builds tools to
accelerate treatment discovery for brain diseases — processing complex 3D microscopy
scans into interactive, interpretable brain maps.

Drug development for brain diseases has one of the highest failure rates in medicine.
The bottleneck is not the amount of data. It is the complexity.

> **Overarching question: How can we extract meaningful information from complex brain imaging data?**
