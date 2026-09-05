# Conceptle

A daily semantic guessing game, built and then killed after playtesting proved the core mechanic was unwinnable.

This repo is published as a negative result. The content pipeline works, the frontend works, the tests pass. The game does not, and the reason is interesting enough to write down.

## The finding

**Cosine similarity between word embeddings measures topical co-occurrence, not conceptual proximity. Outside roughly the top 10 nearest neighbors, the rank signal carries almost no usable information for a player.**

The clearest example, from session 1 of blind playtesting.

Target: `kangaroo`. My guesses and their ranks out of ~11,000:

| Guess | Rank |
|---|---|
| lion | 17 |
| panther | 20 |
| dolphin | 55 |
| cat | 127 |

Four guesses, all reported as extremely close. The game also told me *"both are mammals"* as a shared-attribute hint.

Here is what `kangaroo`'s actual top 10 nearest neighbors look like:

```
1  kangaroo
2  aussie
3  guinea
4  snake
5  commonwealth
6  melbourne
7  camel
8  rabbit
9  aboriginal
10 cactus
```

Kangaroo's semantic fingerprint is **Australia**, not mammals. `lion` at rank 17 is not evidence of proximity to kangaroo. It is an artifact of animal words co-occurring with animal words in the training corpus. The rank was confidently wrong, and the generated attribute hint was confidently wrong alongside it.

This was not an isolated case. Across ten blind sessions:

| Target | Guess | Rank | Actual relationship |
|---|---|---|---|
| mural | waterfall | 90 | none |
| parchment | pasta | 122 | none |
| horizon | pasta | 1479 | none (and this was my *best* guess that round) |
| crossbow | tool (probe) | 174 | misleading — crossbow's fingerprint is weapon, not tool |

**Result: 0 wins in 10 sessions**, playing a 6-guess format.

## Why this kills the format

Contexto and Semantle both use this signal and both require 30–40 guesses to solve. That is not a difficulty choice. It is a structural requirement: when the gradient between rank 15 and rank 2000 is noise, the only viable strategy is exhaustive search across the semantic space. Unlimited guesses is the compensation for a weak signal.

A 6-guess cap plus a flat, noisy gradient is unwinnable. That is arithmetic.

The project's central bet was that adding structured feedback — category tags and LLM-generated shared-attribute phrases — would carry enough information to make a Wordle-length game viable. It did not. The added signals inherited the same flaw: the category tag said `animal` when the answer was Australia, and the attribute phrase said *"both are mammals"*, which was true and useless.

## The part that did work

Every lose screen showed the target's top 10 neighbors. Those lists were consistently excellent:

- `horizon` → sky, panorama, ascension, stellar, hawk, sunset, oblivion, creed, sunrise
- `tunnel` → underground, barrier, trench, maze, blockade, entrance, proxy, cave, gateway
- `kangaroo` → aussie, guinea, snake, commonwealth, melbourne, camel, rabbit, aboriginal, cactus

Any human reading *"aussie, melbourne, commonwealth, aboriginal"* gets kangaroo in seconds.

**The embedding knows the answer. Rank is the wrong way to expose what it knows.** A viable version of this game would reveal neighbors as clues rather than scoring the player's distance. That was designed and specced, then dropped along with the rest.

## What's actually in here

The content pipeline is the substantial part and it works.

**`pipeline/`** — Python, offline, deterministic. Nothing runs at solve time.

- **Vocabulary** — 10,984 lemmas from wordfreq. spaCy POS-aware lemmatization (20,000 → 13,980), proper-noun filtering (→ 10,984), manual blocklist for brand and name leakage that survived the tagger (`hendrix`, `bermuda`, `kfc`, `picasso`).
- **Form resolution** — 13,099 surface-form → lemma mappings so `hunters` resolves to `hunter` instead of returning "not in dictionary". Built by grammar-based inflection over retained lemmas, POS-gated to avoid generating `childed`. Includes a shadowing safety rule: an automatic mapping may never override a surface form that is itself a standalone lemma. Manual overrides limited to genuinely ambiguous cases (`leaves` → `leaf`, `axes` → `axe`).
- **Target curation** — 308 targets, filtered across four review rounds against failure modes found by inspection:
  - *antonym-heavy abstracts* — `freedom` ranks `oppression`, `dictatorship`, and `fascism` in its top 20, because antonyms share every context word
  - *dense clusters* — `guitar` surfaces piano, flute, banjo, cello; the player learns "instrument", never "guitar"
  - *lexical contamination* — `bat` and `batter` ranking near `battery` on shared subword tokens
- **Category tagging** — 27 categories via batched Claude Sonnet calls with structured output. First pass sent 45.8% to `other`; adding `person` and `descriptor` brought it to 9.5%.
- **Attribute generation** — LLM-generated shared-property phrases per (target, neighbor) pair. First pass produced ~25% one-directional phrases (`sponge`/`water` → *"absorbs liquid"* — water does not absorb). Fixed with an explicit symmetry rule in the prompt plus a post-generation blacklist filter.
- **Puzzle generation** — 60 days of static JSON, base64-obfuscated targets, hand-curated target order for days 1–30.

**`web/`** — Next.js + TypeScript + Tailwind. Static, no backend, no accounts, localStorage only. Full keyboard play, WCAG AA, ARIA live announcements of guess results, `prefers-reduced-motion` respected. Graceful degradation for failed fetch, disabled localStorage, and no-JS. 134 tests.

Total API cost to build the entire dataset: **~$2.60**.

## Running it

```bash
cd web
npm install
npm run dev
```

Then `http://localhost:3000`. `?day=N` overrides the day for testing.

To regenerate content:

```bash
cd pipeline
pip install -r requirements.txt
python build_vocabulary.py
python build_embeddings.py
python generate_puzzles.py
```

Embeddings build in ~10 seconds on CPU (`all-MiniLM-L6-v2`, 384-dim).

## Playtest logs

`session_logs.txt` has all ten blind sessions verbatim — every probe, every guess, every rank, and what I was thinking at the point I lost each one. That file is the evidence the rest of this README is built on.

`screenshots/day29-kangaroo-lose.png` and `screenshots/day60-horizon-lose.png` show the lose screens for two of those sessions, including the top-10 neighbor lists that made the problem obvious.

## If you're building something similar

Things worth knowing before you start:

1. **Test the signal before you build the game.** I built a full content pipeline and two frontend iterations before running a proper blind playtest. The kangaroo result would have shown up in twenty minutes of manual probing on day one.
2. **Antonyms are near-neighbors.** `freedom` and `oppression` appear in near-identical contexts. Any abstract noun with a strong opposite is unusable as a target.
3. **Single-word embeddings carry subword contamination.** Transformer sentence models tokenize below the word level, so `bat` scores near `battery`. String-matching filters catch some of it; nothing catches all of it.
4. **LLM-generated relational text defaults to one-directional.** Ask a model what two things share and it will frequently describe what one does to the other. The constraint has to be explicit and it still needs a filter behind it.
5. **Isolated-word POS tagging is ~80% accurate at best.** No sentence context means `fragrance`, `mammoth`, and `buffet` get tagged as proper nouns. Use a whitelist, not a better model.

## License

MIT. Take whatever's useful — the pipeline is the part worth reusing.
