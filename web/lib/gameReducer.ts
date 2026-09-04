import type { AttributeMap } from "./attributes";
import { lookupAttribute } from "./attributes";
import type { CategoryMap } from "./categories";
import { lookupCategory, shouldShowCategory } from "./categories";
import type { FormMap } from "./forms";
import { resolveGuessKey } from "./forms";
import { normalizeGuess } from "./guess";
import { lookupRank, rankToBand, type RankBand } from "./rank";

/** Hard cap for the v2 mechanic: exactly 6 guesses per day, win or lose.
 *  Probes (Phase 2.5.1) never count against this. */
export const MAX_GUESSES = 6;

/** The 5 fixed probe words (Phase 2.5.1, "budget-free" seed words: shown
 *  once per day, submitted as free probes that never cost a guess). Fixed
 *  literal set, not user-typed, so this is the exhaustive list of valid
 *  probe values. */
export const PROBE_WORDS = ["animal", "place", "tool", "feeling", "action"] as const;
export type ProbeWord = (typeof PROBE_WORDS)[number];

export interface GuessRecord {
  word: string; // the surface form the player typed (normalized), for display
  rank: number; // the rank of word's resolved lemma (see resolveGuessKey)
  category?: string; // only set when rank <= CATEGORY_VISIBILITY_RANK_THRESHOLD AND categories.json has an entry
  attribute?: string; // only set when today's attribute file has one for this guess
}

/**
 * v3 (Phase 2.5.1): adds `probes` (free, budget-exempt lookups from the 5
 * fixed probe words) and `probePanelDismissed` (mirrors v1's seedDismissed,
 * renamed for the new terminology) alongside v2's guesses/won. Every other
 * derived value (guessesRemaining/isLost/isGameOver) is still a pure
 * function of `guesses`/`won` only -- probes never factor into them, since
 * they don't consume the 6-guess budget.
 *
 * `version: 3` exists solely to detect and discard both v1 saves
 * (seedDismissed, no version) and v2 saves (version: 2, no probes/
 * probePanelDismissed) on load; see storage.ts's isGameState. Same policy
 * as the v1 -> v2 migration: pre-launch, no real player data is being
 * lost, so a schema mismatch is silently discarded, not migrated field by
 * field.
 *
 * localStorage key stays `conceptle:day:<N>:state`, unchanged.
 */
export interface GameState {
  version: 3;
  guesses: GuessRecord[]; // chronological, oldest first; UI reverses for display
  probes: GuessRecord[]; // chronological, oldest first; never counts toward MAX_GUESSES
  probePanelDismissed: boolean;
  won: boolean;
}

export function initialGameState(): GameState {
  return { version: 3, guesses: [], probes: [], probePanelDismissed: false, won: false };
}

/** Guesses left before the hard cap is hit. Derived, not persisted. Probes
 *  are excluded by design: they never consume a guess. */
export function guessesRemaining(state: GameState): number {
  return MAX_GUESSES - state.guesses.length;
}

/** True once all 6 guesses are used without hitting rank 1. Derived, not
 *  persisted, so it can never drift out of sync with `guesses`/`won`. */
export function isLost(state: GameState): boolean {
  return !state.won && state.guesses.length >= MAX_GUESSES;
}

export function isGameOver(state: GameState): boolean {
  return state.won || isLost(state);
}

/** Everything submitGuess/submitProbe need about today's puzzle, bundled so
 *  the function signature doesn't keep growing one positional param at a
 *  time as later phases add more lookups. Each field defaults to `{}` at
 *  call sites that don't have it yet, so this is additive, not a breaking
 *  change to the pure-function architecture itself. */
export interface DayData {
  ranks: Record<string, number>;
  forms: FormMap;
  categories: CategoryMap;
  attributes: AttributeMap;
}

type PartialDayData = Partial<DayData> & Pick<DayData, "ranks">;

/** Shared by submitGuess and submitProbe: resolve a normalized word to its
 *  rank/category/attribute via the same lemma-resolution pipeline, so a
 *  probe and a typed guess of the same word always agree. Returns undefined
 *  if the word isn't in today's ranks (not-in-dictionary). */
function lookupGuessInfo(
  word: string,
  day: PartialDayData,
): { key: string; rank: number; category?: string; attribute?: string } | undefined {
  const forms = day.forms ?? {};
  const categories = day.categories ?? {};
  const attributes = day.attributes ?? {};

  const key = resolveGuessKey(word, forms);
  const rank = lookupRank(day.ranks, key);
  if (rank === undefined) return undefined;

  const category = shouldShowCategory(rank) ? lookupCategory(key, categories) : undefined;
  const attribute = lookupAttribute(key, attributes);
  return { key, rank, category, attribute };
}

export type SubmitResult =
  | { kind: "added"; state: GameState; band: RankBand }
  | { kind: "duplicate"; state: GameState }
  | { kind: "not-in-dictionary"; state: GameState }
  | { kind: "empty"; state: GameState };

/**
 * Pure state transition: given the current state, a raw guess string, and
 * today's puzzle data, returns the next state and what happened. No I/O, no
 * randomness, no wall-clock reads, so the same (state, rawGuess, day) triple
 * always produces byte-identical output; see gameReducer.test.ts's
 * determinism test.
 *
 * Duplicate detection only ever compares against other REAL guesses, never
 * against probes: a probe and a later real guess of the same word are
 * independent actions (see PROBE_WORDS docs / the Phase 2.5.1 report), and
 * in practice a probe can't even be submitted once a real guess exists
 * (the probe panel's own visibility rule hides it then), so this never
 * actually needs to reject a real-guess-vs-probe collision.
 */
export function submitGuess(state: GameState, rawGuess: string, day: PartialDayData): SubmitResult {
  if (isGameOver(state)) {
    return { kind: "empty", state };
  }

  const word = normalizeGuess(rawGuess);
  if (word === "") {
    return { kind: "empty", state };
  }

  const forms = day.forms ?? {};
  const key = resolveGuessKey(word, forms);
  if (state.guesses.some((g) => resolveGuessKey(g.word, forms) === key)) {
    return { kind: "duplicate", state };
  }

  const info = lookupGuessInfo(word, day);
  if (info === undefined) {
    return { kind: "not-in-dictionary", state };
  }

  const nextState: GameState = {
    ...state,
    guesses: [...state.guesses, { word, rank: info.rank, category: info.category, attribute: info.attribute }],
    won: state.won || info.rank === 1,
  };
  return { kind: "added", state: nextState, band: rankToBand(info.rank) };
}

export type ProbeResult =
  | { kind: "added"; state: GameState; band: RankBand }
  | { kind: "already-used"; state: GameState }
  | { kind: "not-in-dictionary"; state: GameState };

/**
 * Submits one of the 5 fixed PROBE_WORDS as a free lookup: same rank/
 * category/attribute pipeline as a real guess, but appended to `probes`
 * instead of `guesses`, so it never counts against MAX_GUESSES and is
 * excluded from the share string (see lib/share.ts).
 *
 * "Already used" is tracked purely by probe-word membership in
 * `state.probes` (deliberate simplification): the rare case where a probe
 * word is itself lexically-contaminated out of today's ranks (e.g. a
 * target like "animation" would exclude "animal", see
 * generate_puzzles.py's is_lexically_contaminated) returns
 * not-in-dictionary without marking the word used, so reloading the page
 * would offer that probe again. Accepted as out of scope for this fix: the
 * UI only ever offers a probe button once anyway, so this can't surface as
 * a double-click, only as a same-day reload after a rare contamination
 * miss.
 */
export function submitProbe(state: GameState, word: ProbeWord, day: PartialDayData): ProbeResult {
  if (state.probes.some((p) => p.word === word)) {
    return { kind: "already-used", state };
  }

  const info = lookupGuessInfo(word, day);
  if (info === undefined) {
    return { kind: "not-in-dictionary", state };
  }

  const nextState: GameState = {
    ...state,
    probes: [...state.probes, { word, rank: info.rank, category: info.category, attribute: info.attribute }],
    won: state.won || info.rank === 1,
  };
  return { kind: "added", state: nextState, band: rankToBand(info.rank) };
}

export function dismissProbePanel(state: GameState): GameState {
  return state.probePanelDismissed ? state : { ...state, probePanelDismissed: true };
}

/**
 * Best (lowest) rank achieved so far, or undefined if nothing has been
 * looked up yet. Includes probes: the Phase 2.5.1 kickoff says probes
 * "show rank, category tag, and attribute phrase, exactly like a real
 * guess," naming only two explicit exceptions (the 6-guess budget and the
 * share string). The thermometer and lose-tier message aren't in either
 * exception, so a probe that happens to land a great rank moves the
 * thermometer and can improve the eventual lose-tier message, same as a
 * real guess would.
 */
export function bestRank(state: GameState): number | undefined {
  const all = [...state.guesses, ...state.probes];
  if (all.length === 0) return undefined;
  return Math.min(...all.map((g) => g.rank));
}
