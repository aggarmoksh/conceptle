"""Phase 1.6 task A: tag every vocabulary.txt word with exactly one of 27
fixed categories, for the v2 mechanic's category-feedback feature.

v2 (category tagger v2): added "person" (proper nouns, human names, human
roles) and "descriptor" (adjectives/adverbs that modify rather than name a
thing) after v1's "other" bucket came back at 45.8%, dominated by leaked
names and descriptive words that had no real home in the original 25. See
pipeline/data/categories.v1.json for the pre-v2 result kept for reference.

Deviation from "one batched call covering all vocab", forced by the API,
not chosen: a flat {word: category} JSON schema (the token-efficient shape
that would comfortably fit ~11,000 words in one call) is rejected by
output_config.format with "additionalProperties: object is not supported,
set additionalProperties to false" -- the structured-output endpoint only
supports fixed-shape objects, not an open-ended map of unknown keys. The
only schema shape available is the verbose {"classifications": [{"word",
"category"}, ...]} array (the same shape used for the Phase 1.5.1 target
classification), which is roughly 2x the tokens of the flat map per entry
and does not fit the full ~11,000-word vocabulary in one call within
Sonnet 4.6's 128K max output tokens. Split into BATCH_SIZE-word batches as
a result. Each batch is still one call with the full 25-category system
prompt and schema; this is a token-budget necessity, not a quality choice.

The system prompt is saved separately at pipeline/prompts/category_tagger.txt
for reproducibility, per instruction.

Completeness is verified after all batches: any vocabulary word missing
from the combined response triggers one smaller follow-up call for just the
gaps, merged into the final result.

Outputs:
  - pipeline/data/categories.json (source of truth)
  - web/public/categories.json (shipped static asset; NOT web/public/puzzles/,
    per the instruction to ship it "into web/public/ as static asset")

Does not touch vocabulary.txt, embeddings.npy, targets.txt, target_order.txt,
existing puzzle JSONs, or any web/ application code.

Run: .venv/Scripts/python.exe pipeline/tag_categories.py
"""

from __future__ import annotations

import json
import os

import anthropic

CATEGORIES = [
    "animal", "plant", "food", "drink", "tool", "appliance", "vehicle",
    "clothing", "furniture", "building", "place", "natural_feature",
    "weather", "body_part", "cosmetic", "technology", "container",
    "material", "instrument", "sport_equipment", "document", "decoration",
    "person", "descriptor", "action", "abstract_concept", "other",
]

VOCABULARY_PATH = "pipeline/data/vocabulary.txt"
FORMS_PATH = "pipeline/data/forms.json"
PROMPT_PATH = "pipeline/prompts/category_tagger.txt"
OUTPUT_PATH = "pipeline/data/categories.json"
SHIPPED_PATH = "web/public/categories.json"
MODEL = "claude-sonnet-4-6"
BATCH_SIZE = 2750  # ~4 batches for ~11k words; see module docstring for why

CATEGORY_SCHEMA = {
    "type": "object",
    "properties": {
        "classifications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                },
                "required": ["word", "category"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["classifications"],
    "additionalProperties": False,
}


def load_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def classify_batch(client: anthropic.Anthropic, system_prompt: str, words: list[str]) -> dict[str, str]:
    numbered = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(words))
    user_message = f"Classify these {len(words)} words:\n\n{numbered}"

    with client.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
        output_config={"format": {"type": "json_schema", "schema": CATEGORY_SCHEMA}},
    ) as stream:
        response = stream.get_final_message()

    print(
        f"  batch of {len(words)}: input={response.usage.input_tokens} "
        f"output={response.usage.output_tokens} tokens, stop_reason={response.stop_reason}"
    )
    if response.stop_reason == "max_tokens":
        print("  WARNING: hit max_tokens, response may be truncated/incomplete for this batch")
    text = next(b.text for b in response.content if b.type == "text")
    parsed = json.loads(text)
    return {c["word"].strip().lower(): c["category"] for c in parsed["classifications"]}


def main() -> None:
    vocabulary = load_lines(VOCABULARY_PATH)
    vocab_set = set(vocabulary)
    print(f"Loaded {len(vocabulary)} words from {VOCABULARY_PATH}")

    with open(PROMPT_PATH, encoding="utf-8") as f:
        system_prompt = f.read()
    print(f"Loaded system prompt from {PROMPT_PATH} ({len(system_prompt)} chars)")

    client = anthropic.Anthropic(timeout=1200.0)  # generous: large batches

    num_batches = (len(vocabulary) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Calling {MODEL} in {num_batches} batch(es) of up to {BATCH_SIZE} words...")
    categories: dict[str, str] = {}
    for i in range(0, len(vocabulary), BATCH_SIZE):
        chunk = vocabulary[i : i + BATCH_SIZE]
        print(f"Batch {i // BATCH_SIZE + 1}/{num_batches} ({len(chunk)} words)...")
        categories.update(classify_batch(client, system_prompt, chunk))

    missing = [w for w in vocabulary if w not in categories]
    if missing:
        print(f"\n{len(missing)} word(s) missing from the first response, running a follow-up batch for gaps only...")
        followup = classify_batch(client, system_prompt, missing)
        followup = {k.strip().lower(): v for k, v in followup.items()}
        categories.update(followup)
        still_missing = [w for w in vocabulary if w not in categories]
        if still_missing:
            print(f"WARNING: {len(still_missing)} word(s) still missing after follow-up: {still_missing}")
            for w in still_missing:
                categories[w] = "other"
            print("Assigned 'other' as a fallback for these so every vocab word has an entry.")
    else:
        print("\nAll vocabulary words present in the first response, no follow-up needed.")

    # Keep only vocabulary words, in vocabulary.txt's order, dropping anything
    # extraneous the model may have added.
    final = {w: categories[w] for w in vocabulary}

    invalid = {w: c for w, c in final.items() if c not in CATEGORIES}
    if invalid:
        print(f"WARNING: {len(invalid)} invalid category value(s), coercing to 'other': {invalid}")
        for w in invalid:
            final[w] = "other"

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, sort_keys=True, separators=(",", ":"))
    print(f"\nWrote {OUTPUT_PATH}")

    os.makedirs(os.path.dirname(SHIPPED_PATH), exist_ok=True)
    with open(SHIPPED_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, sort_keys=True, separators=(",", ":"))
    print(f"Wrote {SHIPPED_PATH} (shipped copy, same content)")

    size_bytes = os.path.getsize(OUTPUT_PATH)
    print(f"File size: {size_bytes} bytes uncompressed")

    # --- Reporting ---
    from collections import Counter

    counts = Counter(final.values())
    print("\nCategory distribution:")
    for cat in CATEGORIES:
        print(f"  {cat:<18} {counts.get(cat, 0)}")

    other_count = counts.get("other", 0)
    other_pct = 100 * other_count / len(final)
    print(f"\n'other' count: {other_count} / {len(final)} = {other_pct:.1f}%")
    if other_pct > 15:
        print("*** OTHER EXCEEDS 15%: stop and wait for advisor per instructions. ***")

    print("\n10 sample words per category:")
    by_cat: dict[str, list[str]] = {}
    for word, cat in final.items():
        by_cat.setdefault(cat, []).append(word)
    for cat in CATEGORIES:
        sample = sorted(by_cat.get(cat, []))[:10]
        print(f"  {cat:<18} {sample}")

    # General-notes check: any forms.json surface form that coincides with a
    # DIFFERENT standalone vocabulary lemma should have the same category as
    # that lemma (they're the same real-world word after the lemma-shadowing
    # safety rule); if such a surface form exists, its category should match.
    # After the Phase 1.5.1 safety-rule fix this set should be empty.
    with open(FORMS_PATH, encoding="utf-8") as f:
        forms: dict[str, str] = json.load(f)
    shadow_survivors = [s for s in forms if s in vocab_set]
    print(f"\nforms.json surface forms that are ALSO standalone vocab lemmas: {len(shadow_survivors)}")
    if shadow_survivors:
        for surface in shadow_survivors:
            lemma = forms[surface]
            cat_surface = final.get(surface)
            cat_lemma = final.get(lemma)
            flag = " <-- DIFFERENT CATEGORY" if cat_surface != cat_lemma else ""
            print(f"  {surface} (own category {cat_surface}) -> maps to {lemma} (category {cat_lemma}){flag}")
    else:
        print("  None found (expected, per the Phase 1.5.1 lemma-shadowing safety rule).")


if __name__ == "__main__":
    main()
