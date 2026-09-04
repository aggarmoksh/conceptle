"""Generate web/public/puzzles/dayN.json for day 1 through NUM_DAYS.

Determinism rules (see CLAUDE.md):
  - Phase 1.6 target-override closure: days 1 through len(target_override.txt) (30 as
    of this writing) use that file's line N as day N's target, in file order, instead
    of the shuffle below. This is a deliberate hand-picked opening sequence, layered on
    top of the shuffle mechanism rather than replacing it. Days beyond the override
    list fall back to the shuffled order from target_order.txt, skipping any word that
    also appears in target_override.txt so no target is ever assigned to two different
    days. target_order.txt itself is NEVER modified by this: it is name-based (a list
    of words, not indices), so appending new targets to targets.txt or adding an
    override file does not shift or invalidate any existing entry in it. See
    load_day_targets().
  - For days beyond the override list, the day-N target comes from a fixed
    pre-shuffled order of pipeline/data/targets.txt. That order is shuffled once with
    SHUFFLE_SEED and written to pipeline/data/target_order.txt. On every subsequent run
    this script reads the existing order file instead of re-shuffling, so the schedule
    never changes even if targets.txt gains new entries later (new entries simply are
    not reachable until the order file is regenerated on purpose).
  - Rankings are computed once, offline, from the vocabulary embeddings built by
    build_embeddings.py. The client only ever reads the resulting JSON.
  - Each day's target is guaranteed rank 1: it is folded into that day's ranking set
    (added if not already one of the vocabulary words) with similarity 1.0
    against itself.
  - Lexical-contamination filter (advisor review fix #2, extended in Phase 1.5): a
    target like "battery" was surfacing "bat" and "batter" near the top purely because
    they share letters with it, not because they mean anything alike. After ranking,
    any vocab word W (other than the target itself) is dropped from that day's ranks
    if any of:
      (a) W and the target share a prefix of 4+ characters
      (b) the target is a substring of W and len(target) > 3
      (c) W is a substring of the target and len(W) >= 3
    (c) is the Phase 1.5 extension: originally len(W) > 3, which missed "bat" (length
    3) against "battery" since "bat" is a substring of "battery" but only 3 characters
    long. Phase 1.5 also asked for a standalone "W is a prefix of target, len(W) >= 3"
    rule; a prefix is always a substring, so that case is already covered by (c) and
    was not implemented as a separate check. Ranks are then renumbered contiguously
    (1..M) over the surviving words so "lower rank = closer" still holds with no gaps.
    vocab_size reflects the post-filter count.

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
OVERRIDE_PATH = "pipeline/data/target_override.txt"
OUTPUT_DIR = "web/public/puzzles"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

NUM_DAYS = 60
SHUFFLE_SEED = 2026
LAUNCH_EPOCH = "2026-09-15"


def is_lexically_contaminated(word: str, target: str) -> bool:
    """True if `word` overlaps `target` at the letter level with no semantic basis.

    See the module docstring ("Lexical-contamination filter") for the exact rule.
    Never call this for word == target; the target is always kept.
    """
    prefix_len = 0
    for a, b in zip(word, target):
        if a != b:
            break
        prefix_len += 1
    if prefix_len >= 4:
        return True
    if len(target) > 3 and target in word:
        return True
    if len(word) >= 3 and word in target:
        return True
    return False


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


def load_day_targets(target_order: list[str]) -> list[str]:
    """Day N's target for N in 1..NUM_DAYS.

    Days 1..len(target_override.txt) use that file's line N, in order (Phase 1.6
    target-override closure: a deliberate hand-picked opening sequence).

    Note: guitar is a DENSE_CLUSTER target per pipeline/data/
    targets_review_v2.txt, kept as day-11 override by advisor decision due to
    universal cultural recognition. Other DENSE_CLUSTER targets remain excluded.

    Days beyond the override list fall back to target_order.txt's frozen shuffle,
    skipping any word already used as an override target so nothing is assigned
    to two different days.
    """
    override = load_words(OVERRIDE_PATH) if os.path.exists(OVERRIDE_PATH) else []
    override_set = set(override)
    fallback = [w for w in target_order if w not in override_set]

    days_targets = []
    for day in range(1, NUM_DAYS + 1):
        if day <= len(override):
            days_targets.append(override[day - 1])
        else:
            idx = (day - len(override) - 1) % len(fallback)
            days_targets.append(fallback[idx])
    return days_targets


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

    days_targets = load_day_targets(target_order)
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

        # Drop lexically-contaminated words, then renumber contiguously so rank 1..M
        # has no gaps. The target (first in order_idx, similarity 1.0) is always kept.
        survivors = [
            i for i in order_idx
            if words[i] == target or not is_lexically_contaminated(words[i], target)
        ]
        ranks = {words[i]: rank + 1 for rank, i in enumerate(survivors)}

        out_path = os.path.join(OUTPUT_DIR, f"day{day}.json")
        payload = {
            "day": day,
            "target_hint": base64.b64encode(target.encode("utf-8")).decode("ascii"),
            "ranks": ranks,
            "vocab_size": len(ranks),
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, separators=(",", ":"))

        if day == 1:
            day1_report = {
                "target": target,
                "top20": [(words[i], float(sims[i])) for i in survivors[:20]],
                "far_sample": [
                    (words[i], float(sims[i]))
                    for i in random.Random(SHUFFLE_SEED).sample(list(survivors[len(survivors) // 2:]), 5)
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
