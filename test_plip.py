"""Sanity-check that PLIP runs on a single image using the local model files in plip/."""
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

REPO = Path(__file__).parent
MODEL_DIR = REPO / "plip"
IMAGE_PATH = MODEL_DIR / "assets" / "banner.png"

LABELS = [
    "a histopathology slide of breast tissue",
    "a histopathology slide of lung tissue",
    "a fluorescence microscopy image of a mouse brain",
    "a photograph of a cat",
    "a banner image with text",
]


def main() -> None:
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Device: {device}")

    print(f"Loading PLIP from {MODEL_DIR} ...")
    model = CLIPModel.from_pretrained(str(MODEL_DIR)).eval().to(device)
    processor = CLIPProcessor.from_pretrained(str(MODEL_DIR))

    img = Image.open(IMAGE_PATH).convert("RGB")
    print(f"Test image: {IMAGE_PATH.relative_to(REPO)}  size={img.size}")

    inputs = processor(text=LABELS, images=img, return_tensors="pt", padding=True)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        out = model(**inputs)

    image_emb = out.image_embeds / out.image_embeds.norm(dim=-1, keepdim=True)
    text_emb = out.text_embeds / out.text_embeds.norm(dim=-1, keepdim=True)
    sims = (image_emb @ text_emb.T).squeeze(0).cpu().numpy()
    probs = out.logits_per_image.softmax(dim=1).squeeze(0).cpu().numpy()

    order = np.argsort(-sims)
    print("\nZero-shot result (sorted):")
    print(f"{'cos':>8}  {'prob':>8}   label")
    for i in order:
        print(f"{sims[i]:+.4f}  {probs[i]:8.4f}   {LABELS[i]}")

    print(f"\nImage embedding shape: {tuple(image_emb.shape)}")
    print(f"Text  embedding shape: {tuple(text_emb.shape)}")


if __name__ == "__main__":
    main()
