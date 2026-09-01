"""Phase 1.5 task 3: antonym-heavy target curation via one batched Claude API call.

Classifies every word in pipeline/data/targets.txt into one of:
  - CONCRETE: physical object, place, animal, food, tool. Keep.
  - AMBIGUOUS: multiple common meanings that would confuse a guesser (e.g. bat,
    spring, bank). Flag.
  - ABSTRACT_WITH_ANTONYM: abstract with a clear opposite that will pull rankings
    toward its antonym instead of itself (e.g. freedom, love, war, justice). Flag.
  - ABSTRACT_SAFE: abstract but with no dominant antonym (e.g. curiosity,
    nostalgia). Keep, with a note.

This script does NOT modify targets.txt or target_order.txt. It only writes
pipeline/data/targets_review.txt for manual review; the user makes the final cut.

Model is claude-sonnet-4-6, per explicit instruction (not the skill's default
claude-opus-5), in a single call with a JSON-schema structured output so every
word gets exactly one label with no free-form parsing.

Requires ANTHROPIC_API_KEY (or another SDK-recognized credential) in the
environment. Never hardcode a key in this file.

Run: .venv/Scripts/python.exe pipeline/curate_targets.py
"""

from __future__ import annotations

import json

import anthropic

from generate_puzzles import load_words

TARGETS_PATH = "pipeline/data/targets.txt"
REVIEW_OUTPUT_PATH = "pipeline/data/targets_review.txt"
MODEL = "claude-sonnet-4-6"

VALID_LABELS = ["CONCRETE", "AMBIGUOUS", "ABSTRACT_WITH_ANTONYM", "ABSTRACT_SAFE"]

CLASSIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "classifications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "label": {"type": "string", "enum": VALID_LABELS},
                    "note": {
                        "type": "string",
                        "description": (
                            "Brief reason. For AMBIGUOUS, name the competing "
                            "meanings. For ABSTRACT_WITH_ANTONYM, name the "
                            "antonym. For ABSTRACT_SAFE, a short justification "
                            "for why no antonym dominates. May be empty for "
                            "CONCRETE."
                        ),
                    },
                },
                "required": ["word", "label", "note"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["classifications"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You are curating target words for a daily semantic-guessing game \
(like Semantle/Contexto). Players type guesses and see how semantically close each \
guess is to a hidden target word; closer guesses get better (lower) ranks. \
Classify each given word into exactly one category:

- CONCRETE: a physical object, place, animal, food, or tool. Good target, keep.
- AMBIGUOUS: has multiple common, unrelated meanings (e.g. "bat" the animal vs \
sports equipment, "spring" the season vs coil vs water source, "bank" river vs \
financial institution). Flag: guessers would be confused about which sense the \
puzzle intends, and rankings would blend multiple semantic neighborhoods.
- ABSTRACT_WITH_ANTONYM: an abstract concept with one clear, dominant opposite \
(e.g. freedom/oppression, love/hate, war/peace, justice/injustice). Flag: \
semantic similarity models often rank the antonym nearly as close as synonyms, \
which makes ranking-based scoring behave strangely near the target.
- ABSTRACT_SAFE: abstract but has no single dominant antonym that would compete \
for top ranks (e.g. curiosity, nostalgia, rhythm). Keep, but note briefly why.

Classify every single word given, in the same order, and return exactly one \
classification per input word using the word as given (same spelling/case)."""


def build_user_message(targets: list[str]) -> str:
    numbered = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(targets))
    return f"Classify these {len(targets)} target words:\n\n{numbered}"


def main() -> None:
    targets = load_words(TARGETS_PATH)
    print(f"Loaded {len(targets)} targets from {TARGETS_PATH}")

    client = anthropic.Anthropic()

    print(f"Calling {MODEL} for one batched classification request...")
    with client.messages.stream(
        model=MODEL,
        max_tokens=32000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(targets)}],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": CLASSIFICATION_SCHEMA,
            }
        },
    ) as stream:
        response = stream.get_final_message()

    print(f"Response usage: input={response.usage.input_tokens} output={response.usage.output_tokens}")

    text = next(b.text for b in response.content if b.type == "text")
    parsed = json.loads(text)
    classifications = parsed["classifications"]
    print(f"Received {len(classifications)} classifications")

    # Map by lowercased word so casing/whitespace quirks in the response don't
    # cause silent drops; verified for completeness below.
    by_word = {c["word"].strip().lower(): c for c in classifications}

    missing = [w for w in targets if w not in by_word]
    if missing:
        print(f"WARNING: {len(missing)} target word(s) missing from the model's response: {missing}")

    counts = {label: 0 for label in VALID_LABELS}
    counts["MISSING"] = 0

    lines = []
    for word in targets:
        c = by_word.get(word)
        if c is None:
            counts["MISSING"] += 1
            lines.append(f"MISSING\t{word}\t(no classification returned)")
            continue
        label = c["label"]
        note = c.get("note", "").strip()
        counts[label] = counts.get(label, 0) + 1
        lines.append(f"{label}\t{word}\t{note}")

    with open(REVIEW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(
            "# Phase 1.5 task 3: target curation review (claude-sonnet-4-6).\n"
            "# Format: LABEL<TAB>word<TAB>note\n"
            "# This file is informational only. targets.txt and target_order.txt\n"
            "# are NOT modified by this script. Do the final cut manually.\n"
        )
        for line in lines:
            f.write(line + "\n")

    print(f"Wrote {REVIEW_OUTPUT_PATH}")
    print("\nCategory counts:")
    for label, count in counts.items():
        if label == "MISSING" and count == 0:
            continue
        print(f"  {label:<24} {count}")


if __name__ == "__main__":
    main()
