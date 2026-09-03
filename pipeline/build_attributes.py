"""Phase 1.6 task B: shared-attribute phrases for the v2 mechanic.

For each puzzle day's target, generates a shared-attribute phrase for as
many of its top-200 nearest vocabulary neighbors (by cosine similarity,
same ranking + lexical-contamination filter as generate_puzzles.py) as have
a genuine one, via one claude-sonnet-4-6 call per target with a JSON-schema
structured output. Candidates with no meaningful shared attribute are
simply omitted by the model, never filled with a forced/weak phrase.

Two modes:
  --dry-run: runs only the 3 advisor-specified sample targets (refrigerator,
    guitar, bicycle), reports actual token usage and cost, extrapolates to
    304 targets, and writes the raw sample output to
    pipeline/data/attributes_dryrun_sample.json for manual review. Does NOT
    write into pipeline/data/attributes/ or web/public/attributes/, since
    these 3 words are not necessarily tied to a real puzzle day (guitar is
    not currently in targets.txt; see the Task B report for that flag).
  (default) full run: for day 1 through 60, reads that day's target from the
    ALREADY-GENERATED web/public/puzzles/dayN.json (read-only: decodes
    target_hint, never modifies the file), generates attributes, and writes
    pipeline/data/attributes/dayN.json (source of truth) and
    web/public/attributes/dayN.json (shipped copy, same content).

Does not touch vocabulary.txt, embeddings.npy, targets.txt,
target_order.txt, forms.json, categories.json, existing puzzle JSONs, or
any web/ application code.

Run: .venv/Scripts/python.exe pipeline/build_attributes.py [--dry-run]
"""

from __future__ import annotations

import base64
import json
import os
import sys

import anthropic
import numpy as np
from sentence_transformers import SentenceTransformer

from generate_puzzles import is_lexically_contaminated, load_words

VOCAB_PATH = "pipeline/data/vocabulary.txt"
EMBEDDINGS_PATH = "pipeline/data/embeddings.npy"
PROMPT_PATH = "pipeline/prompts/attribute_generator.txt"
PUZZLES_DIR = "web/public/puzzles"  # read-only in this script
ATTRIBUTES_OUT_DIR = "pipeline/data/attributes"
ATTRIBUTES_SHIPPED_DIR = "web/public/attributes"
DRYRUN_SAMPLE_PATH = "pipeline/data/attributes_dryrun_sample.json"

MODEL = "claude-sonnet-4-6"
MODEL_INPUT_PRICE_PER_MTOK = 3.00
MODEL_OUTPUT_PRICE_PER_MTOK = 15.00
TOP_N_NEIGHBORS = 200
NUM_DAYS = 60

DRY_RUN_TARGETS = ["refrigerator", "guitar", "bicycle"]

ATTRIBUTE_SCHEMA = {
    "type": "object",
    "properties": {
        "attributes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "phrase": {"type": "string"},
                },
                "required": ["word", "phrase"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["attributes"],
    "additionalProperties": False,
}


def top_neighbors(
    target: str,
    vocabulary: list[str],
    vocab_embeddings: np.ndarray,
    vocab_set: set[str],
    model: SentenceTransformer,
    n: int = TOP_N_NEIGHBORS,
) -> list[str]:
    """Same ranking + lexical-contamination filter as generate_puzzles.py,
    minus the target itself, truncated to the top n survivors."""
    target_vec = model.encode([target], convert_to_numpy=True, normalize_embeddings=True)[0].astype(np.float32)

    sims = vocab_embeddings @ target_vec
    words = vocabulary
    if target not in vocab_set:
        words = vocabulary + [target]
        sims = np.concatenate([sims, np.array([1.0], dtype=np.float32)])

    order_idx = np.argsort(-sims, kind="stable")
    survivors = [
        i for i in order_idx
        if words[i] != target and not is_lexically_contaminated(words[i], target)
    ]
    return [words[i] for i in survivors[:n]]


def generate_attributes_for_target(
    client: anthropic.Anthropic, system_prompt: str, target: str, candidates: list[str]
) -> tuple[dict[str, str], anthropic.types.Usage]:
    numbered = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(candidates))
    user_message = f'Target: "{target}"\n\nCandidates:\n{numbered}'

    with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        output_config={"format": {"type": "json_schema", "schema": ATTRIBUTE_SCHEMA}},
    ) as stream:
        response = stream.get_final_message()

    text = next(b.text for b in response.content if b.type == "text")
    parsed = json.loads(text)

    candidate_set = set(candidates)
    result: dict[str, str] = {}
    dropped = []
    for item in parsed["attributes"]:
        word, phrase = item["word"].strip(), item["phrase"].strip()
        word_count = len(phrase.split())
        if word not in candidate_set:
            dropped.append((word, phrase, "not a given candidate"))
            continue
        if not (2 <= word_count <= 4):
            dropped.append((word, phrase, f"{word_count} words, not 2-4"))
            continue
        if word in result:
            dropped.append((word, phrase, "duplicate word"))
            continue
        result[word] = phrase

    if dropped:
        print(f"    dropped {len(dropped)} invalid entrie(s) for target '{target}': {dropped}")

    return result, response.usage


def cost_for_usage(usage: anthropic.types.Usage) -> float:
    return (
        usage.input_tokens / 1_000_000 * MODEL_INPUT_PRICE_PER_MTOK
        + usage.output_tokens / 1_000_000 * MODEL_OUTPUT_PRICE_PER_MTOK
    )


def load_shared_state():
    vocabulary = load_words(VOCAB_PATH)
    vocab_set = set(vocabulary)
    vocab_embeddings = np.load(EMBEDDINGS_PATH)
    with open(PROMPT_PATH, encoding="utf-8") as f:
        system_prompt = f.read()
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
    client = anthropic.Anthropic(timeout=600.0)
    return vocabulary, vocab_set, vocab_embeddings, system_prompt, model, client


def run_dry_run() -> None:
    vocabulary, vocab_set, vocab_embeddings, system_prompt, model, client = load_shared_state()

    total_cost = 0.0
    sample_output: dict[str, dict] = {}
    for target in DRY_RUN_TARGETS:
        candidates = top_neighbors(target, vocabulary, vocab_embeddings, vocab_set, model)
        print(f"Target '{target}': {len(candidates)} candidates, calling {MODEL}...")
        attributes, usage = generate_attributes_for_target(client, system_prompt, target, candidates)
        cost = cost_for_usage(usage)
        total_cost += cost
        print(
            f"  input={usage.input_tokens} output={usage.output_tokens} tokens, "
            f"cost=${cost:.4f}, {len(attributes)}/{len(candidates)} candidates got a phrase"
        )
        sample_output[target] = {
            "num_candidates": len(candidates),
            "num_attributes": len(attributes),
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": round(cost, 4),
            "attributes": attributes,
        }

    with open(DRYRUN_SAMPLE_PATH, "w", encoding="utf-8") as f:
        json.dump(sample_output, f, indent=2, sort_keys=True)
    print(f"\nWrote {DRYRUN_SAMPLE_PATH}")

    avg_cost = total_cost / len(DRY_RUN_TARGETS)
    extrapolated = avg_cost * 304
    print(f"\n3-target total cost: ${total_cost:.4f}")
    print(f"Average cost per target: ${avg_cost:.4f}")
    print(f"Extrapolated cost for 304 targets: ${extrapolated:.2f}")
    if extrapolated > 20:
        print("*** EXCEEDS $20 BUDGET: stop and wait for advisor approval. ***")
    else:
        print("Under $20 budget.")


def run_full() -> None:
    vocabulary, vocab_set, vocab_embeddings, system_prompt, model, client = load_shared_state()

    os.makedirs(ATTRIBUTES_OUT_DIR, exist_ok=True)
    os.makedirs(ATTRIBUTES_SHIPPED_DIR, exist_ok=True)

    total_cost = 0.0
    low_coverage_days = []
    for day in range(1, NUM_DAYS + 1):
        puzzle_path = os.path.join(PUZZLES_DIR, f"day{day}.json")
        with open(puzzle_path, encoding="utf-8") as f:
            puzzle = json.load(f)  # read-only: never written back
        target = base64.b64decode(puzzle["target_hint"]).decode("utf-8")

        candidates = top_neighbors(target, vocabulary, vocab_embeddings, vocab_set, model)
        print(f"Day {day}/{NUM_DAYS}, target '{target}': {len(candidates)} candidates...")
        attributes, usage = generate_attributes_for_target(client, system_prompt, target, candidates)
        cost = cost_for_usage(usage)
        total_cost += cost
        print(f"  {len(attributes)}/{len(candidates)} got a phrase, cost=${cost:.4f}, running total=${total_cost:.2f}")

        if len(attributes) < 30:
            low_coverage_days.append((day, target, len(attributes)))

        payload = {"day": day, "attributes": attributes}
        for out_dir in (ATTRIBUTES_OUT_DIR, ATTRIBUTES_SHIPPED_DIR):
            with open(os.path.join(out_dir, f"day{day}.json"), "w", encoding="utf-8") as f:
                json.dump(payload, f, separators=(",", ":"))

    print(f"\nTotal API cost for {NUM_DAYS} days: ${total_cost:.2f}")
    print(f"\nDays with fewer than 30 attributes generated ({len(low_coverage_days)}):")
    for day, target, count in low_coverage_days:
        print(f"  day {day}: '{target}' -> {count} attributes")


if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        run_dry_run()
    else:
        run_full()
