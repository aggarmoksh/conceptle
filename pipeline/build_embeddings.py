"""One-time step: embed every vocabulary word with all-MiniLM-L6-v2 and save the matrix.

Reads pipeline/data/vocabulary.txt (one word per line, in vocabulary rank order).
Writes pipeline/data/embeddings.npy: float32 array of shape (len(vocabulary), 384),
row i is the embedding of vocabulary line i. Row order must stay aligned with the
vocabulary file; generate_puzzles.py depends on that alignment and never re-derives it.

Model is locked per CLAUDE.md: sentence-transformers/all-MiniLM-L6-v2. Do not swap
without asking the user.

Run: .venv/Scripts/python.exe pipeline/build_embeddings.py
"""

from __future__ import annotations

import time

import numpy as np
from sentence_transformers import SentenceTransformer

VOCAB_PATH = "pipeline/data/vocabulary.txt"
OUTPUT_PATH = "pipeline/data/embeddings.npy"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def load_vocabulary(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def main() -> None:
    vocabulary = load_vocabulary(VOCAB_PATH)
    print(f"Loaded {len(vocabulary)} vocabulary words from {VOCAB_PATH}")

    print(f"Loading model {MODEL_NAME} (CPU)...")
    model = SentenceTransformer(MODEL_NAME, device="cpu")

    print("Encoding vocabulary...")
    start = time.time()
    embeddings = model.encode(
        vocabulary,
        batch_size=256,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,  # so dot product == cosine similarity downstream
    )
    elapsed = time.time() - start
    print(f"Encoded {len(vocabulary)} words in {elapsed:.1f}s ({embeddings.shape[1]}-dim)")

    embeddings = embeddings.astype(np.float32)
    np.save(OUTPUT_PATH, embeddings)
    print(f"Saved {embeddings.shape} to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
