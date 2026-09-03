"""Build pipeline/data/vocabulary.txt from wordfreq's frequency-ranked English word list.

Source justification [Certain]: `wordfreq` (Robyn Speer, MIT license) derives frequency
ranks for common words from a blend of Wikipedia, subtitles, news, books, and Twitter
text. It ships as a pip package with no download step and no licensing risk, and
`top_n_list` gives a ready-made "N most common words" list, which is exactly the shape
CLAUDE.md asks for.

Filtering applied, in order:
  1. Pull more raw candidates than we need (`RAW_POOL_SIZE`) since filtering removes some.
  2. Keep only pure alphabetic tokens (drops numbers, contractions, hyphenated forms).
  3. Drop tokens shorter than 3 letters.
  4. Drop a small curated block-list of proper nouns / brand names / calendar words that
     wordfreq's corpus surfaces as "common" despite being names, not common nouns.
     [Likely] incomplete: wordfreq has no part-of-speech or named-entity tagging, so this
     is a manual, non-exhaustive pass. The Phase 1 sanity check is the backstop.
  5. Truncate to TARGET_SIZE (this is the pre-lemmatization vocabulary size).
  6. Drop anything in pipeline/data/vocab_blocklist.txt regardless of POS tag (Phase
     1.5 final pass): brand names, person names, and place names that survived both
     the in-code BLOCKLIST and the PROPN filter and turned up as top-20 contamination
     via topical/brand association rather than genuine meaning (e.g. "fender" and
     "gibson" near "guitar", "bermuda" near "ocean"). This is a manually curated,
     project-specific list distinct from BLOCKLIST above; see that file for entries
     and the "Accepted trade" reasoning per entry.
  7. Lemmatize every surviving word with spaCy's POS-aware lemmatizer (en_core_web_sm,
     tagger + attribute_ruler + lemmatizer only, parser/NER disabled for speed) and
     dedupe by lemma, keeping the earliest (highest-frequency) surface form's position
     to decide final ordering. This is what collapses inflectional variants like
     charge/charging/charged into a single vocabulary entry "charge", fixing the
     morphological-clumping issue flagged in advisor review: without it, a target like
     "battery" ranked its own inflections (charging, charged, ...) as separate top-20
     entries purely because they share most of their embedding, not because they're
     meaningfully distinct guesses.
     [Likely] imperfect: spaCy's tagger runs on each word in isolation (no sentence
     context), so a handful of words get an unreliable POS guess and fail to merge with
     their base form (e.g. "geese" was misread as a proper noun and stayed unlemmatized
     instead of merging into "goose" in spot checks). Rare, and caught by review/reruns,
     not solved by a bigger model for this MVP.
  8. pipeline/data/vocab_whitelist.txt overrides step 7's PROPN drop for specific
     words the tagger got wrong in isolation (e.g. "fragrance", "mammoth", "mural",
     "buffet" were all misread as proper nouns with no sentence context to disambiguate).
     A whitelisted word still goes through every other filter (alpha, length,
     BLOCKLIST, vocab_blocklist.txt, lemma dedup) normally; only the PROPN drop is
     skipped for it.

Phase 1.5.1 addition: also writes forms.json, a surface-form -> lemma map (e.g.
"hunters" -> "hunter") for every surface form seen in this same lemmatization pass
whose lemma survived into vocabulary.txt. This fixes a client/pipeline mismatch:
the pipeline lemmatizes vocabulary at build time, but the web client was doing a
literal string lookup, so a player typing a natural inflection ("hunters") that
isn't itself a vocabulary entry got a false "not in dictionary". forms.json lets
the client translate a typed surface form to its lemma before rank lookup.

This is purely additive instrumentation on the SAME lemmatization pass that
produces vocabulary.txt: the control flow that decides what goes into
`final`/`seen_lemmas` is untouched, so vocabulary.txt (and therefore
embeddings.npy, which is derived from it) must come out byte-identical to before.
Verified by diffing vocabulary.txt across the rerun; see the Phase 1.5.1 report.

Written to two places: pipeline/data/forms.json (source of truth, pipeline-
internal) and web/public/puzzles/forms.json (the copy the client actually
fetches, alongside the per-day puzzle JSONs). No new pipeline step or ordering
dependency: build_vocabulary.py is the natural single owner of this mapping
since it is a byproduct of the same lemmatization pass, not something
generate_puzzles.py's per-day ranking logic touches.

Run: .venv/Scripts/python.exe pipeline/build_vocabulary.py
"""

from __future__ import annotations

import json
import os
import random
import re

import spacy
from wordfreq import top_n_list

TARGET_SIZE = 20000
RAW_POOL_SIZE = 32000
OUTPUT_PATH = "pipeline/data/vocabulary.txt"
WHITELIST_PATH = "pipeline/data/vocab_whitelist.txt"
EXTERNAL_BLOCKLIST_PATH = "pipeline/data/vocab_blocklist.txt"
FORMS_OUTPUT_PATH = "pipeline/data/forms.json"
FORMS_SHIPPED_PATH = "web/public/puzzles/forms.json"
REPORT_SEED = 2026  # for the reproducible PROPN spot-check sample, not gameplay

# Common lexically-ambiguous English forms (a single surface form with two
# unrelated readings, e.g. "leaves" as plural-of-"leaf" vs. 3rd-person-singular
# of "leave"). spaCy's tagger picks one reading per isolated word with no
# sentence context to disambiguate, same as everywhere else in this pipeline;
# this list is only used to report which of them ended up in forms.json and
# what spaCy resolved them to, for the Phase 1.5.1 report's spot-check ask.
# Not a filter, not a correction: purely diagnostic.
KNOWN_AMBIGUOUS_FORMS = {
    "leaves", "bats", "saws", "rows", "wounds", "axes", "bores", "leads",
    "objects", "produces", "records", "presents", "permits", "projects",
    "refuses", "contracts", "conducts", "converts", "rebels", "subjects",
    "closes", "houses", "uses", "bows", "winds", "tears", "does", "lives",
}

ALPHA_RE = re.compile(r"^[a-z]+$")


def load_word_set(path: str) -> set[str]:
    """One lowercased word per line; blank lines and lines starting with # ignored."""
    with open(path, encoding="utf-8") as f:
        return {
            line.strip().lower()
            for line in f
            if line.strip() and not line.strip().startswith("#")
        }

# Curated block-list: common proper nouns, brand names, and calendar words that surface
# high in wordfreq's "common English words" list. Not exhaustive by design (see
# module docstring point 4).
BLOCKLIST = {
    # months / days
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    # countries / continents / regions (commonly used generically in casual text)
    "america", "american", "americans", "england", "english", "britain", "british",
    "china", "chinese", "japan", "japanese", "france", "french", "germany", "german",
    "india", "indian", "russia", "russian", "canada", "canadian", "australia",
    "australian", "mexico", "mexican", "spain", "spanish", "italy", "italian",
    "africa", "african", "europe", "european", "asia", "asian", "ireland", "irish",
    "scotland", "scottish", "wales", "welsh", "brazil", "brazilian", "egypt",
    "egyptian", "greece", "greek", "korea", "korean", "vietnam", "vietnamese",
    # major cities
    "london", "paris", "york", "angeles", "chicago", "boston", "vegas", "tokyo",
    "beijing", "moscow", "berlin", "madrid", "rome", "dublin", "sydney", "toronto",
    "seattle", "miami", "dallas", "houston", "atlanta", "denver", "detroit",
    "phoenix", "portland", "austin", "philadelphia", "vancouver", "prague",
    # big tech / brand names common in corpora
    "google", "facebook", "twitter", "amazon", "microsoft", "apple", "youtube",
    "instagram", "netflix", "spotify", "yahoo", "reddit", "wikipedia", "snapchat",
    "tiktok", "uber", "ebay", "linkedin", "samsung", "nokia", "adobe", "oracle",
    "nike", "disney", "pepsi", "sony", "toyota", "honda", "walmart",
    # common first / last human names that rank high in casual-text corpora
    "john", "james", "robert", "michael", "william", "david", "richard", "joseph",
    "thomas", "charles", "mary", "patricia", "jennifer", "linda", "elizabeth",
    "susan", "jessica", "sarah", "karen", "smith", "johnson", "williams", "jones",
    "brown", "davis", "miller", "wilson", "moore", "taylor", "anderson",
    "jackson", "martin", "lee", "harris", "clark", "lewis", "walker", "hall",
    "allen", "young", "king", "wright", "scott", "green", "baker", "carter",
    "mitchell", "roberts", "phillips", "campbell", "parker", "evans", "edwards",
    "collins", "stewart", "morris", "murphy", "cook", "rogers", "morgan", "peterson",
    "cooper", "reed", "bailey", "bell", "gray", "kelly", "sanders", "price",
    "bennett", "wood", "barnes", "ross", "henderson", "coleman", "jenkins", "perry",
    "powell", "long", "patterson", "hughes", "flores", "washington", "butler",
    "simmons", "foster", "gonzales", "bryant", "alexander", "russell", "griffin",
    "diaz", "hayes", "rothschild", "schwarzenegger", "rhodesia",
}


def build_pre_lemma_vocabulary(extra_blocklist: set[str]) -> list[str]:
    """Frequency-ranked, filtered, alphabetic vocabulary before lemmatization."""
    raw = top_n_list("en", RAW_POOL_SIZE)

    seen: set[str] = set()
    candidates: list[str] = []
    for word in raw:
        if word in seen:
            continue
        if not ALPHA_RE.match(word):
            continue
        if len(word) < 3:
            continue
        if word in BLOCKLIST or word in extra_blocklist:
            continue
        seen.add(word)
        candidates.append(word)
        if len(candidates) >= TARGET_SIZE:
            break

    return candidates


def lemmatize_dedupe_and_filter_propn(
    words: list[str],
    whitelist: set[str],
    extra_blocklist: set[str],
) -> tuple[list[str], list[str], dict[str, str]]:
    """Lemmatize, drop proper nouns, and collapse inflectional variants to one entry each.

    Proper-noun filter (Phase 1.5 task 2): each word is POS-tagged by spaCy in
    isolation (no sentence context) and dropped if tagged PROPN, UNLESS it is in
    `whitelist` (Phase 1.5 final pass: overrides the PROPN drop for words spaCy
    got wrong in isolation, e.g. "mammoth"). This is a second, independent pass
    over the same manual BLOCKLIST approach in build_pre_lemma_vocabulary() above:
    the block-list only catches proper nouns someone thought to list by hand,
    while this catches whatever spaCy's tagger recognizes as a name-like token, at
    the cost of the tagger's own error rate on single-word (no-context) input,
    which is the known imperfection the whitelist exists to patch.

    `extra_blocklist` (pipeline/data/vocab_blocklist.txt) drops a word unconditionally,
    regardless of POS tag or whitelist status, checked against both the surface form
    and its lemma.

    Order is preserved by first (highest-frequency) occurrence of each lemma.
    Returns (final_vocabulary, words_dropped_for_being_tagged_propn, forms).

    `forms` (Phase 1.5.1) maps every surface form processed here whose lemma
    differs from itself AND survived into `final`, to that lemma (e.g.
    "hunters" -> "hunter"). It is built by observing the exact same
    accept/reject decisions used to build `final` below, just also recording
    the surface form when it differs from a lemma that made the cut; it never
    changes which lemmas make it into `final`.
    """
    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

    final: list[str] = []
    seen_lemmas: set[str] = set()
    removed_propn: list[str] = []
    forms: dict[str, str] = {}
    for doc in nlp.pipe(words, batch_size=512):
        token = doc[0]
        surface = token.text.lower()
        if surface in extra_blocklist:
            continue
        if token.pos_ == "PROPN" and surface not in whitelist:
            removed_propn.append(token.text)
            continue
        lemma = token.lemma_.lower()
        if lemma in extra_blocklist:
            continue
        if not ALPHA_RE.match(lemma):
            continue
        if len(lemma) < 3:
            continue
        if lemma in BLOCKLIST:
            continue
        if lemma not in seen_lemmas:
            seen_lemmas.add(lemma)
            final.append(lemma)
        if surface != lemma:
            # `words` (the pre-lemma pool) is already deduplicated upstream in
            # build_pre_lemma_vocabulary, so each surface form is processed at
            # most once here; there is no dict-collision case to resolve.
            forms[surface] = lemma

    return final, removed_propn, forms


def main() -> None:
    whitelist = load_word_set(WHITELIST_PATH)
    extra_blocklist = load_word_set(EXTERNAL_BLOCKLIST_PATH)
    print(f"Loaded {len(whitelist)} whitelist word(s) from {WHITELIST_PATH}: {sorted(whitelist)}")
    print(f"Loaded {len(extra_blocklist)} blocklist word(s) from {EXTERNAL_BLOCKLIST_PATH}: {sorted(extra_blocklist)}")

    print(f"Pulling top {RAW_POOL_SIZE} words from wordfreq...")
    pre_lemma = build_pre_lemma_vocabulary(extra_blocklist)
    print(f"Vocab size before lemmatization: {len(pre_lemma)}")

    print("Lemmatizing with spaCy (en_core_web_sm), dropping PROPN, and deduping...")
    vocabulary, removed_propn, forms = lemmatize_dedupe_and_filter_propn(
        pre_lemma, whitelist, extra_blocklist
    )
    print(f"Vocab size after lemmatization + PROPN filter: {len(vocabulary)}")
    print(f"Words dropped for being tagged PROPN: {len(removed_propn)}")

    sample_size = min(20, len(removed_propn))
    sample = random.Random(REPORT_SEED).sample(removed_propn, sample_size)
    print(f"Random sample of {sample_size} PROPN-dropped words (spot-check these):")
    print(" ", sample)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for word in vocabulary:
            f.write(word + "\n")

    print(f"Wrote {OUTPUT_PATH}")
    print("First 20:", vocabulary[:20])
    print("Last 20:", vocabulary[-20:])

    # Phase 1.5.1: surface-form -> lemma map for the client's guess resolution.
    print(f"\nBuilt forms.json: {len(forms)} surface form(s) map to a different, retained lemma")
    with open(FORMS_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(forms, f, sort_keys=True, indent=None, separators=(",", ":"))
    print(f"Wrote {FORMS_OUTPUT_PATH}")

    os.makedirs(os.path.dirname(FORMS_SHIPPED_PATH), exist_ok=True)
    with open(FORMS_SHIPPED_PATH, "w", encoding="utf-8") as f:
        json.dump(forms, f, sort_keys=True, indent=None, separators=(",", ":"))
    print(f"Wrote {FORMS_SHIPPED_PATH} (shipped copy, same content)")

    found_ambiguous = {w: forms[w] for w in KNOWN_AMBIGUOUS_FORMS if w in forms}
    print(f"\nKnown-ambiguous forms found in forms.json ({len(found_ambiguous)}):")
    for word in sorted(found_ambiguous):
        print(f"  {word:<12} -> {found_ambiguous[word]}")


if __name__ == "__main__":
    main()
