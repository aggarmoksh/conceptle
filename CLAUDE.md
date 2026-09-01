# CLAUDE.md — Conceptle Project Brief

You are the coding assistant for Conceptle, a solo-dev daily semantic-guessing web game. This file is your persistent project context. Read it fully at the start of every session.

## Project overview

**Conceptle** is a browser-based daily puzzle in the family of Contexto and Semantle, generalized beyond words to concepts across all domains (science, history, culture, everyday objects). One puzzle per day, same for everyone, deterministic.

**Core loop:** User types a guess word. System returns the rank of that word among the vocabulary, ordered by semantic similarity to today's secret concept. Rank 1 means the user found today's target. Lower rank number = closer. User keeps guessing until rank 1 is hit. Score = number of guesses.

**Why this game:** Fully deterministic, algorithmic content, near-zero solve-time cost (all rankings precomputed), no licensing risk, self-promoting dev/knowledge community.

**Non-goals for the MVP:**
- No accounts, no login, no server-side state
- No multiplayer, no leaderboard, no chat
- No unlimited practice mode, no hard mode variants
- No monetization, no ads

## Tech stack (locked, do not suggest alternatives without asking user)

- **Frontend:** Next.js (App Router) + React + Tailwind CSS
- **Content pipeline:** Python 3.11+, sentence-transformers, numpy
- **Embedding model:** `sentence-transformers/all-MiniLM-L6-v2` (384-dim, fast, free, runs on CPU). Do NOT swap this without asking.
- **State:** localStorage only (no backend, no database)
- **Hosting target:** Cloudflare Pages, purely static export (`next build && next export` pattern or Next.js static output)
- **Repo:** github.com/<user>/conceptle (private during dev, public at hard launch)

## Repo layout (create this in Phase 1)

```
D:\Conceptle\
├── CLAUDE.md                     (this file)
├── README.md                     (public-facing, Phase 5)
├── .gitignore
├── pipeline\                     (Python content generation)
│   ├── requirements.txt
│   ├── build_embeddings.py       (one-time: compute vocab embeddings)
│   ├── generate_puzzles.py       (rerun to extend puzzle days)
│   ├── data\
│   │   ├── vocabulary.txt        (curated word list)
│   │   ├── targets.txt           (curated target words)
│   │   └── embeddings.npy        (git-ignored, regeneratable)
│   └── output\
│       └── (day JSONs get copied to web\public\puzzles\)
├── web\                          (Next.js app)
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── public\
│   │   └── puzzles\
│   │       ├── day1.json
│   │       ├── day2.json
│   │       └── ...
│   ├── app\
│   │   ├── layout.tsx
│   │   ├── page.tsx              (the game)
│   │   └── stats\page.tsx        (Phase 3)
│   └── components\
│       ├── GuessInput.tsx
│       ├── GuessList.tsx
│       └── ShareButton.tsx
```

## Coding conventions

- **Full file replacements when showing code to the user.** No diffs, no "apply this patch" snippets. If a file changes, show the whole file.
- **No em dashes in prose or comments.** Use commas, colons, or restructure the sentence.
- **Banned phrases in prose:** "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely". Skip warm-up sentences. Start responses with the most useful information.
- **Use confidence tags** in explanations: [Certain] / [Likely] / [Guessing] before non-obvious claims.
- **Windows + Git Bash environment.** Use forward-slash paths in bash commands. Use PowerShell only if bash cannot do it.
- **Python:** black-formatted, type hints on function signatures, docstrings on non-trivial functions.
- **TypeScript:** strict mode on, no `any` unless justified in a comment.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Small, atomic. Never commit `embeddings.npy` or `node_modules`.

## Determinism rules (critical)

- Day numbering is derived from a fixed launch epoch date (set at Phase 1 start, e.g., `2026-09-15`). Day N = launch epoch + N days. Never depend on client's timezone in a way that changes which puzzle is served.
- The target for day N is selected deterministically from `targets.txt` using `targets[N % len(targets)]` (or a fixed pre-shuffled order committed to git).
- Rankings are precomputed offline in Python and shipped as static JSON. The client never computes embeddings.
- Puzzle files live at `web/public/puzzles/dayN.json`. Format:
  ```json
  {
    "day": 1,
    "target_hint": "obfuscated for anti-spoiler",
    "ranks": {
      "ocean": 1,
      "sea": 2,
      "water": 3,
      "...": 4,
      "banana": 15432
    },
    "vocab_size": 20000
  }
  ```
- Reveal the actual target word only on client win, not in the initial page load. Consider base64 obfuscation of the target field to defeat casual view-source spoilers.

## Anti-cheat posture

Casual anti-spoiler only. Do not overengineer. Determined users can always read client-side files. Goal: stop the "peek at source" 30-second cheat, nothing more.

## Content pipeline principles

- **Generate at build time, never at solve time.** The client must never call an LLM or embedding API.
- **Vocabulary size:** target 15,000 to 25,000 common English words for MVP. Filter out proper nouns, plurals of nouns already in list, obscure archaic words.
- **Target words:** curated list of 300 to 500 concrete, well-known nouns/concepts (e.g., ocean, guitar, hospital, freedom, planet). Avoid obscure words, avoid words with double meanings that will frustrate players.
- **Rerun cadence:** pipeline generates puzzles for the next 90 days at a time. User reruns manually every ~60 days.

## Phase gates (STRICT)

Work in the phases below. **Do not proceed past a phase boundary without telling the user "Phase N complete, go consult your advisor before Phase N+1."** The user will paste a phase kickoff message to start each phase.

### Phase 1: Content pipeline
- Deliverable: working Python pipeline that produces `web/public/puzzles/day1.json` through `day60.json`
- Also produce a sanity-check report: for day 1, print the target word and top 20 ranked words
- Exit criteria: user confirms the target and top-20 ranks look reasonable

### Phase 2: Next.js MVP
- Deliverable: playable game at `localhost:3000` that loads today's JSON, accepts guesses, shows ranked guess list, detects win, stores state in localStorage
- No share string, no stats page yet
- Exit criteria: user plays a full round successfully

### Phase 3: Share string, stats, streak
- Deliverable: shareable text output on win, stats page (games played, win %, current streak, max streak), copy-to-clipboard button
- Exit criteria: user tests share string on iOS Messages and confirms rendering

### Phase 4: Deploy to Cloudflare Pages
- Deliverable: live URL at a cloudflare-pages.dev subdomain, static export working, GitHub auto-deploy configured
- Exit criteria: user confirms game works on production URL from a phone

### Phase 5: Hard launch prep
- Deliverable: meta tags (OG image, Twitter card), favicon, minimal landing copy, drafted Show HN post, drafted subreddit post
- Exit criteria: user has posted or is ready to post

## Interaction rules with user

- User is beginner-to-intermediate. Explain what a command does the first time you run it. After that, no need to re-explain.
- If a technical decision has real trade-offs, present the options with 1-sentence pros/cons and ask which the user wants. Do not silently pick.
- If the user asks you to skip a phase or add a feature that violates non-goals, push back once with the reason from this doc, then defer if they insist.
- When a phase completes, say exactly: `Phase N complete. Stop here and go consult your advisor with: [list of specific artifacts and questions].`

## Known pitfalls to watch for

- **Timezone bug:** Rolling over to the next day at the wrong hour. Use launch-epoch-based day numbering, not `new Date().toDateString()`.
- **iOS Messages share bug:** Emoji spacing and newlines render differently on iOS Messages than desktop preview. User will test on real device in Phase 3.
- **Vercel free tier trap:** Do NOT deploy to Vercel. Its Hobby plan prohibits commercial use. Cloudflare Pages only.
- **Embeddings on git:** `embeddings.npy` can be 30 to 100 MB. Never commit. Add to `.gitignore` in Phase 1.
- **Client bundle bloat:** Do not ship the full embedding matrix to the browser. Only per-day rank JSON.
