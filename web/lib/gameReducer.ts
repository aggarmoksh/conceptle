import { normalizeGuess } from "./guess";
import { lookupRank, rankToBand, type RankBand } from "./rank";

export interface GuessRecord {
  word: string;
  rank: number;
}

/** Matches the localStorage schema in the Phase 2 kickoff exactly:
 *  conceptle:day:<N>:state = { guesses: [{word, rank}], won, seedDismissed } */
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
 * Pure state transition: given the current state, a raw guess string, and
 * today's rank table, returns the next state and what happened. No I/O, no
 * randomness, no wall-clock reads, so the same (state, rawGuess, ranks)
 * triple always produces byte-identical output; see gameReducer.test.ts's
 * determinism test.
 */
export function submitGuess(
  state: GameState,
  rawGuess: string,
  ranks: Record<string, number>,
): SubmitResult {
  if (state.won) {
    return { kind: "empty", state };
  }

  const word = normalizeGuess(rawGuess);
  if (word === "") {
    return { kind: "empty", state };
  }

  if (state.guesses.some((g) => g.word === word)) {
    return { kind: "duplicate", state };
  }

  const rank = lookupRank(ranks, word);
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
