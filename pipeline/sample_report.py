"""Ad hoc diagnostic: print top-20 nearest vocab words for a handful of sample words,
using the exact same ranking + lexical-contamination filter as generate_puzzles.py.

These sample words do not need to be in pipeline/data/targets.txt; this script embeds
them directly. Useful for spot-checking pipeline quality without touching any
committed puzzle JSON.

Run: .venv/Scripts/python.exe pipeline/sample_report.py word1 word2 ...
"""

from __future__ import annotations

import sys

import numpy as np
from sentence_transformers import SentenceTransformer

from generate_puzzles import is_lexically_contaminated, load_words

VOCAB_PATH = "pipeline/data/vocabulary.txt"
EMBEDDINGS_PATH = "pipeline/data/embeddings.npy"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def main() -> None:
    sample_words = sys.argv[1:] or ["battery", "ocean", "guitar", "hospital", "freedom"]

    vocabulary = load_words(VOCAB_PATH)
    vocab_embeddings = np.load(EMBEDDINGS_PATH)
    vocab_set = set(vocabulary)

    model = SentenceTransformer(MODEL_NAME, device="cpu")
    sample_vecs = model.encode(
        sample_words, convert_to_numpy=True, normalize_embeddings=True
    ).astype(np.float32)

    for target, target_vec in zip(sample_words, sample_vecs):
        sims = vocab_embeddings @ target_vec
        words = vocabulary
        if target not in vocab_set:
            words = vocabulary + [target]
            sims = np.concatenate([sims, np.array([1.0], dtype=np.float32)])

        order_idx = np.argsort(-sims, kind="stable")
        survivors = [
            i for i in order_idx
            if words[i] == target or not is_lexically_contaminated(words[i], target)
        ]

        print("=" * 60)
        print(f"target = {target!r}  (in vocab: {target in vocab_set})")
        print("=" * 60)
        for rank, i in enumerate(survivors[:20], start=1):
            print(f"  {rank:>2}. {words[i]:<20} cos={sims[i]:.4f}")
        print()


if __name__ == "__main__":
    main()
