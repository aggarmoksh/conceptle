import type { FormMap } from "./forms";
import { resolveGuessKey } from "./forms";
import { normalizeGuess } from "./guess";
import { lookupRank, rankToBand, type RankBand } from "./rank";

export interface GuessRecord {
  word: string; // the surface form the player typed (normalized), for display
  rank: number; // the rank of word's resolved lemma (see resolveGuessKey)
}

/** Matches the localStorage schema in the Phase 2 kickoff exactly:
 *  conceptle:day:<N>:state = { guesses: [{word, rank}], won, seedDismissed }
 *  Unchanged by Phase 1.5.1: lemma resolution is recomputed from `word` via
 *  forms.json wherever it's needed (dedup, rank lookup), not persisted, so
 *  the schema and any previously-saved state stay valid as-is. */
export interface GameState {
  guesses: GuessRecord[]; // chronological, oldest first; UI reverses for display
  won: boolean;
  seedDismissed: boolean;
}

export function initialGameState(): GameState {
  return { guesses: [], won: false, seedDismissed: false };
}

export type SubmitResult =
  | { kind: "added"; state: GameState; band: RankBand }
  | { kind: "duplicate"; state: GameState }
  | { kind: "not-in-dictionary"; state: GameState }
  | { kind: "empty"; state: GameState };

/**
 * Pure state transition: given the current state, a raw guess string,
 * today's rank table, and the surface-form-to-lemma map, returns the next
 * state and what happened. No I/O, no randomness, no wall-clock reads, so
 * the same (state, rawGuess, ranks, forms) quadruple always produces
 * byte-identical output; see gameReducer.test.ts's determinism test.
 *
 * `forms` defaults to {} so existing call sites/tests that pass no forms map
 * keep their prior (pre-1.5.1, exact-match-only) behavior.
 */
export function submitGuess(
  state: GameState,
  rawGuess: string,
  ranks: Record<string, number>,
  forms: FormMap = {},
): SubmitResult {
  if (state.won) {
    return { kind: "empty", state };
  }

  const word = normalizeGuess(rawGuess);
  if (word === "") {
    return { kind: "empty", state };
  }

  // Duplicate detection and rank lookup both go through the resolved lemma
  // key, not the raw surface form: "hunter" then "hunters" are the same
  // guess as far as the puzzle is concerned, even though the display word
  // (kept as `word` below) differs.
  const key = resolveGuessKey(word, forms);
  if (state.guesses.some((g) => resolveGuessKey(g.word, forms) === key)) {
    return { kind: "duplicate", state };
  }

  const rank = lookupRank(ranks, key);
  if (rank === undefined) {
    return { kind: "not-in-dictionary", state };
  }

  const nextState: GameState = {
    guesses: [...state.guesses, { word, rank }],
    won: rank === 1,
    seedDismissed: true, // first successful guess also retires the seed panel
  };
  return { kind: "added", state: nextState, band: rankToBand(rank) };
}

export function dismissSeedPanel(state: GameState): GameState {
  return state.seedDismissed ? state : { ...state, seedDismissed: true };
}

/** Best (lowest) rank achieved so far, or undefined if no guesses yet. */
export function bestRank(state: GameState): number | undefined {
  if (state.guesses.length === 0) return undefined;
  return Math.min(...state.guesses.map((g) => g.rank));
}
