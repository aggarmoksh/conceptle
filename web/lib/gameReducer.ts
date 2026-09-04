import type { AttributeMap } from "./attributes";
import { lookupAttribute } from "./attributes";
import type { CategoryMap } from "./categories";
import { lookupCategory, shouldShowCategory } from "./categories";
import type { FormMap } from "./forms";
import { resolveGuessKey } from "./forms";
import { normalizeGuess } from "./guess";
import { lookupRank, rankToBand, type RankBand } from "./rank";

/** Hard cap for the v2 mechanic: exactly 6 guesses per day, win or lose. */
export const MAX_GUESSES = 6;

export interface GuessRecord {
  word: string; // the surface form the player typed (normalized), for display
  rank: number; // the rank of word's resolved lemma (see resolveGuessKey)
  category?: string; // only set when rank <= 500 AND categories.json has an entry
  attribute?: string; // only set when today's attribute file has one for this guess
}

/**
 * v2 (Phase 2.5): every field here is either intrinsic to a guess (word,
 * rank) or a pure function of `guesses`/`won` (see guessesRemaining/isLost/
 * isGameOver below), so nothing else needs to be persisted. `version: 2`
 * exists solely to detect and discard v1 saves (which had `seedDismissed`
 * and no hard guess cap) on load; see storage.ts's isGameState. Per the
 * kickoff: "if v1 state exists for a day, discard it silently, we're
 * pre-launch, no real player data is being lost."
 *
 * localStorage key stays `conceptle:day:<N>:state`, unchanged.
 */
export interface GameState {
  version: 2;
  guesses: GuessRecord[]; // chronological, oldest first; UI reverses for display
  won: boolean;
}

export function initialGameState(): GameState {
  return { version: 2, guesses: [], won: false };
}

/** Guesses left before the hard cap is hit. Derived, not persisted. */
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

/** Everything submitGuess needs about today's puzzle, bundled so the
 *  function signature doesn't keep growing one positional param at a time
 *  as v2 adds category/attribute lookups. Each field defaults to `{}` at
 *  call sites that don't have it yet (see submitGuess), so this is additive,
 *  not a breaking change to the pure-function architecture itself. */
export interface DayData {
  ranks: Record<string, number>;
  forms: FormMap;
  categories: CategoryMap;
  attributes: AttributeMap;
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
 */
export function submitGuess(
  state: GameState,
  rawGuess: string,
  day: Partial<DayData> & Pick<DayData, "ranks">,
): SubmitResult {
  if (isGameOver(state)) {
    return { kind: "empty", state };
  }

  const word = normalizeGuess(rawGuess);
  if (word === "") {
    return { kind: "empty", state };
  }

  const forms = day.forms ?? {};
  const categories = day.categories ?? {};
  const attributes = day.attributes ?? {};

  // Duplicate detection and rank lookup both go through the resolved lemma
  // key, not the raw surface form: "hunter" then "hunters" are the same
  // guess as far as the puzzle is concerned, even though the display word
  // (kept as `word` below) differs.
  const key = resolveGuessKey(word, forms);
  if (state.guesses.some((g) => resolveGuessKey(g.word, forms) === key)) {
    return { kind: "duplicate", state };
  }

  const rank = lookupRank(day.ranks, key);
  if (rank === undefined) {
    return { kind: "not-in-dictionary", state };
  }

  const category = shouldShowCategory(rank) ? lookupCategory(key, categories) : undefined;
  const attribute = lookupAttribute(key, attributes);

  const nextState: GameState = {
    version: 2,
    guesses: [...state.guesses, { word, rank, category, attribute }],
    won: rank === 1,
  };
  return { kind: "added", state: nextState, band: rankToBand(rank) };
}

/** Best (lowest) rank achieved so far, or undefined if no guesses yet. */
export function bestRank(state: GameState): number | undefined {
  if (state.guesses.length === 0) return undefined;
  return Math.min(...state.guesses.map((g) => g.rank));
}
