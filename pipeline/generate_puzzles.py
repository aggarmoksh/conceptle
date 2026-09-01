"""Generate web/public/puzzles/dayN.json for day 1 through NUM_DAYS.

Determinism rules (see CLAUDE.md):
  - The day-N target comes from a fixed pre-shuffled order of pipeline/data/targets.txt.
    That order is shuffled once with SHUFFLE_SEED and written to
    pipeline/data/target_order.txt. On every subsequent run this script reads the
    existing order file instead of re-shuffling, so the schedule never changes even if
    targets.txt gains new entries later (new entries simply are not reachable until the
    order file is regenerated on purpose).
  - Rankings are computed once, offline, from the vocabulary embeddings built by
    build_embeddings.py. The client only ever reads the resulting JSON.
  - Each day's target is guaranteed rank 1: it is folded into that day's ranking set
    (added if not already one of the 20,000 vocabulary words) with similarity 1.0
    against itself.

Output per day (web/public/puzzles/dayN.json):
  {
    "day": N,
    "target_hint": "<base64 of the plaintext target word>",
    "ranks": {"word": rank, ...}   # every guessable word, rank 1 = the target
    "vocab_size": <int>
  }

Also writes web/public/puzzles/meta.json (launch epoch + shuffle seed, for the Next.js
app to compute "which day is today" from in Phase 2) and prints a sanity-check report
for day 1 (kickoff step 4): target, top 20 nearest words with cosine scores, and 5
randomly sampled far words.

Run: .venv/Scripts/python.exe pipeline/generate_puzzles.py
"""

from __future__ import annotations

import base64
import json
import os
import random

import numpy as np
from sentence_transformers import SentenceTransformer

VOCAB_PATH = "pipeline/data/vocabulary.txt"
EMBEDDINGS_PATH = "pipeline/data/embeddings.npy"
TARGETS_PATH = "pipeline/data/targets.txt"
ORDER_PATH = "pipeline/data/target_order.txt"
OUTPUT_DIR = "web/public/puzzles"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

NUM_DAYS = 60
SHUFFLE_SEED = 2026
LAUNCH_EPOCH = "2026-09-15"


def load_words(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [
            line.strip()
            for line in f
            if line.strip() and not line.strip().startswith("#")
        ]


def load_or_create_target_order(targets: list[str]) -> list[str]:
    """Return the fixed pre-shuffled target order, creating it on first run only."""
    if os.path.exists(ORDER_PATH):
        order = load_words(ORDER_PATH)
        order_set, target_set = set(order), set(targets)
        if order_set != target_set:
            missing = target_set - order_set
            extra = order_set - target_set
            print(
                "WARNING: pipeline/data/target_order.txt no longer matches "
                "pipeline/data/targets.txt exactly."
            )
            if missing:
                print(f"  targets.txt has {len(missing)} word(s) not in the frozen order (ignored): {sorted(missing)[:10]}...")
            if extra:
                print(f"  frozen order has {len(extra)} word(s) no longer in targets.txt (kept anyway): {sorted(extra)[:10]}...")
        print(f"Reusing existing fixed target order from {ORDER_PATH} ({len(order)} entries)")
        return order

    print(f"No {ORDER_PATH} found. Shuffling targets.txt once with seed={SHUFFLE_SEED}...")
    order = list(targets)
    random.Random(SHUFFLE_SEED).shuffle(order)
    with open(ORDER_PATH, "w", encoding="utf-8") as f:
        f.write(f"# Fixed shuffle of targets.txt, seed={SHUFFLE_SEED}. Do not hand-edit order.\n")
        for word in order:
            f.write(word + "\n")
    print(f"Wrote frozen order to {ORDER_PATH}. Commit this file, it must never change.")
    return order


def main() -> None:
    vocabulary = load_words(VOCAB_PATH)
    vocab_embeddings = np.load(EMBEDDINGS_PATH)
    assert vocab_embeddings.shape[0] == len(vocabulary), (
        "vocabulary.txt and embeddings.npy are out of sync, rerun build_embeddings.py"
    )
    vocab_set = set(vocabulary)
    print(f"Loaded {len(vocabulary)} vocab words and {vocab_embeddings.shape} embeddings")

    targets = load_words(TARGETS_PATH)
    print(f"Loaded {len(targets)} candidate targets from {TARGETS_PATH}")
    target_order = load_or_create_target_order(targets)

    days_targets = [target_order[(day - 1) % len(target_order)] for day in range(1, NUM_DAYS + 1)]
    unique_needed = sorted(set(days_targets))

    print(f"Loading model {MODEL_NAME} (CPU) to embed {len(unique_needed)} target word(s)...")
    model = SentenceTransformer(MODEL_NAME, device="cpu")
    target_vecs = model.encode(
        unique_needed,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32)
    target_embedding_map = dict(zip(unique_needed, target_vecs))

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    day1_report = None

    for day in range(1, NUM_DAYS + 1):
        target = days_targets[day - 1]
        target_vec = target_embedding_map[target]

        similarities = vocab_embeddings @ target_vec  # cosine, since both are unit norm

        words = vocabulary
        sims = similarities
        if target not in vocab_set:
            words = vocabulary + [target]
            sims = np.concatenate([similarities, np.array([1.0], dtype=np.float32)])

        order_idx = np.argsort(-sims, kind="stable")
        ranks = {words[i]: rank + 1 for rank, i in enumerate(order_idx)}

        out_path = os.path.join(OUTPUT_DIR, f"day{day}.json")
        payload = {
            "day": day,
            "target_hint": base64.b64encode(target.encode("utf-8")).decode("ascii"),
            "ranks": ranks,
            "vocab_size": len(words),
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))

        if day == 1:
            day1_report = {
                "target": target,
                "top20": [(words[i], float(sims[i])) for i in order_idx[:20]],
                "far_sample": [
                    (words[i], float(sims[i]))
                    for i in random.Random(SHUFFLE_SEED).sample(list(order_idx[len(order_idx) // 2:]), 5)
                ],
            }

        if day % 10 == 0 or day == 1:
            print(f"  day {day}: target='{target}' -> {out_path}")

    meta_path = os.path.join(OUTPUT_DIR, "meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "launch_epoch": LAUNCH_EPOCH,
                "shuffle_seed": SHUFFLE_SEED,
                "days_generated": NUM_DAYS,
            },
            f,
            indent=2,
        )
    print(f"Wrote {meta_path}")

    print("\n" + "=" * 60)
    print("SANITY CHECK REPORT: day 1")
    print("=" * 60)
    print(f"Day 1 target: {day1_report['target']}")
    print("\nTop 20 nearest words:")
    for rank, (word, score) in enumerate(day1_report["top20"], start=1):
        print(f"  {rank:>2}. {word:<20} cos={score:.4f}")
    print("\n5 randomly sampled far words (bottom half of the ranking):")
    for word, score in day1_report["far_sample"]:
        print(f"  {word:<20} cos={score:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
