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
  6. Lemmatize every surviving word with spaCy's POS-aware lemmatizer (en_core_web_sm,
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

Run: .venv/Scripts/python.exe pipeline/build_vocabulary.py
"""

from __future__ import annotations

import random
import re

import spacy
from wordfreq import top_n_list

TARGET_SIZE = 20000
RAW_POOL_SIZE = 32000
OUTPUT_PATH = "pipeline/data/vocabulary.txt"
REPORT_SEED = 2026  # for the reproducible PROPN spot-check sample, not gameplay

ALPHA_RE = re.compile(r"^[a-z]+$")

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


def build_pre_lemma_vocabulary() -> list[str]:
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
        if word in BLOCKLIST:
            continue
        seen.add(word)
        candidates.append(word)
        if len(candidates) >= TARGET_SIZE:
            break

    return candidates


def lemmatize_dedupe_and_filter_propn(
    words: list[str],
) -> tuple[list[str], list[str]]:
    """Lemmatize, drop proper nouns, and collapse inflectional variants to one entry each.

    Proper-noun filter (Phase 1.5 task 2): each word is POS-tagged by spaCy in
    isolation (no sentence context) and dropped if tagged PROPN. This is a second,
    independent pass over the same manual BLOCKLIST approach in
    build_pre_lemma_vocabulary() above: the block-list only catches proper nouns
    someone thought to list by hand, while this catches whatever spaCy's tagger
    recognizes as a name-like token, at the cost of the tagger's own error rate on
    single-word (no-context) input, which is the known imperfection to spot-check
    the returned sample against, per the module docstring's caveat about "geese".

    Order is preserved by first (highest-frequency) occurrence of each lemma.
    Returns (final_vocabulary, words_dropped_for_being_tagged_propn).
    """
    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

    final: list[str] = []
    seen_lemmas: set[str] = set()
    removed_propn: list[str] = []
    for doc in nlp.pipe(words, batch_size=512):
        token = doc[0]
        if token.pos_ == "PROPN":
            removed_propn.append(token.text)
            continue
        lemma = token.lemma_.lower()
        if not ALPHA_RE.match(lemma):
            continue
        if len(lemma) < 3:
            continue
        if lemma in BLOCKLIST:
            continue
        if lemma in seen_lemmas:
            continue
        seen_lemmas.add(lemma)
        final.append(lemma)

    return final, removed_propn


def main() -> None:
    print(f"Pulling top {RAW_POOL_SIZE} words from wordfreq...")
    pre_lemma = build_pre_lemma_vocabulary()
    print(f"Vocab size before lemmatization: {len(pre_lemma)}")

    print("Lemmatizing with spaCy (en_core_web_sm), dropping PROPN, and deduping...")
    vocabulary, removed_propn = lemmatize_dedupe_and_filter_propn(pre_lemma)
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


if __name__ == "__main__":
    main()
