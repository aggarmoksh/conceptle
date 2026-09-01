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
  5. Drop obvious plurals of a noun already kept (simple heuristic: strip a trailing "s"
     or "es" and check if the singular form is already in the set). [Likely] imperfect
     for irregular plurals, acceptable for MVP per CLAUDE.md's "casual" filtering bar.
  6. Truncate to the final target size.

Run: .venv/Scripts/python.exe pipeline/build_vocabulary.py
"""

from __future__ import annotations

import re

from wordfreq import top_n_list

TARGET_SIZE = 20000
RAW_POOL_SIZE = 32000
OUTPUT_PATH = "pipeline/data/vocabulary.txt"

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
    "phoenix", "portland", "austin", "philadelphia", "vancouver",
    # big tech / brand names common in corpora
    "google", "facebook", "twitter", "amazon", "microsoft", "apple", "youtube",
    "instagram", "netflix", "spotify", "yahoo", "reddit", "wikipedia", "snapchat",
    "tiktok", "uber", "ebay", "linkedin", "samsung", "nokia", "adobe", "oracle",
    "nike", "disney", "pepsi", "sony", "toyota", "honda", "walmart",
    # common first / last human names that rank high in casual-text corpora
    "john", "james", "robert", "michael", "william", "david", "richard", "joseph",
    "thomas", "charles", "mary", "patricia", "jennifer", "linda", "elizabeth",
    "susan", "jessica", "sarah", "karen", "smith", "johnson", "williams", "jones",
    "brown", "davis", "miller", "wilson", "moore", "taylor", "anderson", "thomas",
    "jackson", "martin", "lee", "harris", "clark", "lewis", "walker", "hall",
    "allen", "young", "king", "wright", "scott", "green", "baker", "carter",
    "mitchell", "roberts", "phillips", "campbell", "parker", "evans", "edwards",
    "collins", "stewart", "morris", "murphy", "cook", "rogers", "morgan", "peterson",
    "cooper", "reed", "bailey", "bell", "gray", "kelly", "sanders", "price",
    "bennett", "wood", "barnes", "ross", "henderson", "coleman", "jenkins", "perry",
    "powell", "long", "patterson", "hughes", "flores", "washington", "butler",
    "simmons", "foster", "gonzales", "bryant", "alexander", "russell", "griffin",
    "diaz", "hayes",
}


def strip_plural(word: str) -> str | None:
    """Return the likely singular form of `word` if it looks like a simple plural."""
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("es") and len(word) > 3:
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        return word[:-1]
    return None


def build_vocabulary() -> list[str]:
    raw = top_n_list("en", RAW_POOL_SIZE)

    kept: list[str] = []
    seen: set[str] = set()

    # Pass 1: alphabetic, length, blocklist filters, de-dup.
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

    # Pass 2: drop plurals of a noun already present, preserving frequency order
    # (earlier == more frequent, so we keep whichever form wordfreq ranks first).
    candidate_set = set(candidates)
    dropped: set[str] = set()
    for word in candidates:
        singular = strip_plural(word)
        if singular and singular != word and singular in candidate_set and singular not in dropped:
            dropped.add(word)

    for word in candidates:
        if word not in dropped:
            kept.append(word)
        if len(kept) >= TARGET_SIZE:
            break

    return kept


def main() -> None:
    print(f"Pulling top {RAW_POOL_SIZE} words from wordfreq...")
    vocabulary = build_vocabulary()
    print(f"Kept {len(vocabulary)} words after filtering (target was {TARGET_SIZE}).")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for word in vocabulary:
            f.write(word + "\n")

    print(f"Wrote {OUTPUT_PATH}")
    print("First 20:", vocabulary[:20])
    print("Last 20:", vocabulary[-20:])


if __name__ == "__main__":
    main()
