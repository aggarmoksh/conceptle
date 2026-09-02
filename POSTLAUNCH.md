# Post-launch / out-of-scope ideas

Things noticed while building that are not in the current phase's requirements.
Do not build these without the user asking; this file is just so they aren't
forgotten or silently added.

## From Phase 2 (Next.js MVP)

- **Day beyond the generated range.** `resolveDayNumber` clamps to `maxDay`
  (60), so once the pipeline's 60 generated days are exhausted, every day
  after that silently replays day 60 instead of telling the player "come back
  once more puzzles are generated." Fine for Phase 2 (dev-only, pre-launch),
  but worth a real UX decision before the 60-day window is reached in
  production, and again as a factor when the pipeline reruns and extends the
  range.
- **New-best micro-interaction.** The thermometer marker just moves (with a
  reduced-motion-safe transition) when the session's best rank improves.
  A more celebratory cue (brief pulse, color flash) was considered and
  deliberately skipped for Phase 2 to keep the surface area small and the
  motion budget minimal; revisit if the game feels flat.
- **PWA / mobile home-screen install.** No manifest.json or install prompt.
  Not asked for; likely relevant closer to hard launch (Phase 5).
- **Rate-limiting rapid guess submission.** Not needed at MVP scale (all
  computation is a local object lookup), but worth a look if this ever grows
  a network-backed guess path.
