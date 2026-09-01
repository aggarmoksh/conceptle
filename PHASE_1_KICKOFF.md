# Phase 1 kickoff (paste this into Claude Code as your FIRST prompt)

Start Phase 1 of Conceptle. Read CLAUDE.md fully before doing anything.

Objectives for Phase 1:
1. Create the repo scaffolding described in CLAUDE.md (folders, .gitignore, README stub, both requirements.txt and package.json stubs).
2. Connect the local repo to my GitHub remote. I will provide the URL when you ask.
3. Build the Python content pipeline in `pipeline/`:
   - Source a vocabulary of 15,000 to 25,000 common English words. Pick a source you can justify (e.g., google-10000-english, wordfreq top-N, or a curated combination). Filter out proper nouns, obvious plurals of nouns already present, and words shorter than 3 letters. Save to `pipeline/data/vocabulary.txt`.
   - Source or curate a target-word list of 300 to 500 concrete concepts. These are the daily secrets. Prefer nouns you can visualize or explain in one sentence. Save to `pipeline/data/targets.txt`.
   - `build_embeddings.py`: load vocabulary, embed every word using `sentence-transformers/all-MiniLM-L6-v2`, save the embedding matrix to `pipeline/data/embeddings.npy`. Print progress. Should run in under 5 minutes on CPU.
   - `generate_puzzles.py`: for each day 1 through 60, pick the day's target from `targets.txt` in a fixed pre-shuffled order (seed the shuffle with an integer I approve, save the shuffled order to disk so it never changes), compute cosine similarity of the target to every vocab word, rank them, and write `web/public/puzzles/dayN.json` with the format specified in CLAUDE.md. Include base64 obfuscation of the target field.
4. Produce a sanity-check report: print day 1's target, its top 20 nearest words with cosine scores, and 5 randomly sampled far words to confirm the model is behaving sanely.
5. Do NOT touch the Next.js `web/` folder beyond creating the empty structure and the `public/puzzles/` folder that receives outputs.

Decisions I need you to ask me about before making them:
- Launch epoch date (I need to pick this; default suggestion: today's date + 14 days).
- Shuffle seed (a specific integer).
- The exact vocabulary source, once you have researched 2 or 3 options with pros/cons.
- The exact target-word source or generation approach (curate manually? filter from vocabulary? use a small LLM call to Claude to draft candidates that I then approve?).

At the end of Phase 1, do exactly what CLAUDE.md says: print "Phase 1 complete. Stop here and go consult your advisor with: [artifacts]" and list what I should bring back.

Begin.
