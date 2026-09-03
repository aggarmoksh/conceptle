"""Phase 1.5.1 follow-up: expand pipeline/data/forms.json with grammar-based
inflections and manual overrides for isolated-word POS ambiguity.

Rerun order: build_vocabulary.py (produces vocabulary.txt and a first-pass,
wordfreq-derived pipeline/data/forms.json, unchanged by this script) -> this
script (expands and rewrites forms.json in place). Neither build_embeddings.py
nor generate_puzzles.py need to rerun afterward: vocabulary.txt and
targets.txt are untouched by both scripts, so embeddings.npy and every day's
puzzle JSON stay byte-identical.

Three sources of surface-form -> lemma mappings, merged with this precedence
(highest wins):

  1. pipeline/data/lemma_overrides.txt: hand-picked fixes for isolated-word
     POS ambiguity. Wins over everything, INCLUDING a surface form that is
     itself a distinct standalone vocabulary lemma -- that is the deliberate
     point of a manual override. See that file's header for which entries
     carry that shadowing tradeoff.

  2. The existing wordfreq-derived forms.json from build_vocabulary.py:
     grounded in an actual corpus surface form spaCy lemmatized during real
     vocabulary construction, so preferred over synthetic generation.

  3. Grammar-generated forms (this script, via pyinflect): fills the gap for
     lemmas whose common inflections never appeared in the original wordfreq
     top-N pool (e.g. "claws" ranks too low in wordfreq to be in the raw
     20k-word candidate pool build_vocabulary.py drew from, but is an
     everyday plural a player would type for the retained lemma "claw").

Safety rule, applied to sources 2 and 3 (never to source 1, the overrides):
a mapping is discarded if its surface form is itself a distinct, standalone
lemma already in vocabulary.txt. This was found to already be a live bug in
the existing wordfreq-derived forms.json before this script ever ran: 67
entries (e.g. "found" -> "find" when "found" is also its own vocabulary
lemma for the unrelated verb "to found"; "bound" -> "bind" likewise; plus a
handful of outright spaCy lemmatizer artifacts like "cling" -> "cle" and
"lens" -> "len"). All 67 are fixed by this same rule, applied uniformly to
both sources rather than special-cased.

Run (after build_vocabulary.py): .venv/Scripts/python.exe pipeline/build_forms.py
"""

from __future__ import annotations

import json
import os
import re

import spacy

VOCABULARY_PATH = "pipeline/data/vocabulary.txt"
FORMS_PATH = "pipeline/data/forms.json"  # read the wordfreq-derived version, then overwrite
OVERRIDES_PATH = "pipeline/data/lemma_overrides.txt"
FORMS_SHIPPED_PATH = "web/public/puzzles/forms.json"

ALPHA_RE = re.compile(r"^[a-z]+$")

# NNS is attempted for every lemma regardless of spaCy's detected POS: the
# isolated-word tagger frequently mistags common nouns as PROPN with no
# sentence context (the "geese" case from Phase 1.5, recurring here as
# wolf/mouse/tooth -> PROPN), and pluralizing a noun is safe even when the
# POS guess is wrong. Verb and adjective inflections are gated on the
# detected POS to avoid nonsense like "child" -> "childed"/"childing".
NOUN_TAGS = ["NNS"]
VERB_TAGS = ["VBD", "VBN", "VBG", "VBZ"]
ADJ_TAGS = ["JJR", "JJS"]


def load_vocabulary(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def load_overrides(path: str) -> dict[str, str]:
    overrides: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) != 2:
                continue
            surface, lemma = parts[0].strip().lower(), parts[1].strip().lower()
            overrides[surface] = lemma
    return overrides


def generate_grammar_forms(vocabulary: list[str]) -> dict[str, str]:
    """pyinflect-based inflections for every retained lemma in vocabulary.txt."""
    import pyinflect  # noqa: F401  (registers the spaCy Token._.inflect extension)

    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
    generated: dict[str, str] = {}

    for doc in nlp.pipe(vocabulary, batch_size=512):
        token = doc[0]
        lemma = token.text.lower()  # every vocabulary.txt entry IS the lemma

        tags_to_try = list(NOUN_TAGS)
        if token.pos_ == "VERB":
            tags_to_try += VERB_TAGS
        elif token.pos_ == "ADJ":
            tags_to_try += ADJ_TAGS

        for tag in tags_to_try:
            result = token._.inflect(tag)
            if not result:
                continue
            surface = result.lower()
            if surface == lemma:
                continue
            if not ALPHA_RE.match(surface) or len(surface) < 3:
                continue
            generated.setdefault(surface, lemma)

    return generated


def main() -> None:
    vocabulary = load_vocabulary(VOCABULARY_PATH)
    vocab_set = set(vocabulary)
    print(f"Loaded {len(vocabulary)} lemmas from {VOCABULARY_PATH}")

    with open(FORMS_PATH, encoding="utf-8") as f:
        wordfreq_forms: dict[str, str] = json.load(f)
    print(f"Loaded {len(wordfreq_forms)} wordfreq-derived form(s) from {FORMS_PATH}")

    overrides = load_overrides(OVERRIDES_PATH)
    print(f"Loaded {len(overrides)} manual override(s) from {OVERRIDES_PATH}: {overrides}")

    print("Generating grammar-based inflections with pyinflect (takes a moment)...")
    grammar_forms = generate_grammar_forms(vocabulary)
    print(f"Generated {len(grammar_forms)} grammar-derived form(s) before safety filtering")

    # Merge non-override sources: wordfreq wins over grammar on a conflicting key.
    merged: dict[str, str] = dict(grammar_forms)
    merged.update(wordfreq_forms)

    # Safety rule: never let an automatic (non-override) mapping shadow a
    # surface form that is itself a distinct, standalone vocabulary lemma.
    shadowing_removed = sorted(s for s in merged if s in vocab_set)
    for surface in shadowing_removed:
        del merged[surface]
    print(
        f"Removed {len(shadowing_removed)} automatic mapping(s) that shadowed a standalone "
        f"vocabulary lemma: {shadowing_removed}"
    )

    # Overrides apply last, unconditionally, including re-introducing a
    # deliberate shadow for the entries designed to do that.
    override_shadows = []
    for surface, lemma in overrides.items():
        if lemma not in vocab_set:
            print(f"WARNING: override target {lemma!r} for {surface!r} not in vocabulary.txt, skipped")
            continue
        if surface in vocab_set:
            override_shadows.append(surface)
        merged[surface] = lemma

    # Belt-and-suspenders: a mapping is only useful if its target is guessable.
    merged = {s: l for s, l in merged.items() if l in vocab_set}

    print(f"\nFinal merged forms.json: {len(merged)} surface form(s)")
    print(f"Overrides that deliberately shadow a standalone vocabulary word: {override_shadows}")

    with open(FORMS_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, sort_keys=True, separators=(",", ":"))
    print(f"Wrote {FORMS_PATH}")

    os.makedirs(os.path.dirname(FORMS_SHIPPED_PATH), exist_ok=True)
    with open(FORMS_SHIPPED_PATH, "w", encoding="utf-8") as f:
        json.dump(merged, f, sort_keys=True, separators=(",", ":"))
    print(f"Wrote {FORMS_SHIPPED_PATH} (shipped copy, same content)")


if __name__ == "__main__":
    main()
