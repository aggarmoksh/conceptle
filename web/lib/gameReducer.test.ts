import {
  bestRank,
  dismissSeedPanel,
  initialGameState,
  submitGuess,
  type GameState,
} from "./gameReducer";

const RANKS = { battery: 1, charge: 2, recharge: 3, banana: 15432 };

describe("submitGuess", () => {
  test("adds a new valid guess and reports its band", () => {
    const result = submitGuess(initialGameState(), "charge", RANKS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses).toEqual([{ word: "charge", rank: 2 }]);
    expect(result.band).toBe("bright-green");
    expect(result.state.won).toBe(false);
  });

  test("normalizes the raw guess before lookup", () => {
    const result = submitGuess(initialGameState(), "  Charge! ", RANKS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.word).toBe("charge");
  });

  test("guessing the rank-1 word wins", () => {
    const result = submitGuess(initialGameState(), "battery", RANKS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.won).toBe(true);
    expect(result.band).toBe("gold");
  });

  test("a duplicate guess is rejected and state is unchanged", () => {
    const afterFirst = submitGuess(initialGameState(), "charge", RANKS).state;
    const result = submitGuess(afterFirst, "charge", RANKS);
    expect(result.kind).toBe("duplicate");
    expect(result.state).toEqual(afterFirst);
    expect(result.state.guesses).toHaveLength(1);
  });

  test("a word not in today's ranks is rejected and state is unchanged", () => {
    const start = initialGameState();
    const result = submitGuess(start, "zzznotaword", RANKS);
    expect(result.kind).toBe("not-in-dictionary");
    expect(result.state).toEqual(start);
  });

  test("an empty-after-normalizing guess is a no-op", () => {
    const start = initialGameState();
    const result = submitGuess(start, "!!!", RANKS);
    expect(result.kind).toBe("empty");
    expect(result.state).toEqual(start);
  });

  test("once won, further submissions are no-ops", () => {
    const won = submitGuess(initialGameState(), "battery", RANKS).state;
    const result = submitGuess(won, "charge", RANKS);
    expect(result.kind).toBe("empty");
    expect(result.state).toEqual(won);
    expect(result.state.guesses).toHaveLength(1);
  });

  test("the first added guess also dismisses the seed panel", () => {
    const result = submitGuess(initialGameState(), "charge", RANKS);
    expect(result.state.seedDismissed).toBe(true);
  });

  test("a rejected guess (duplicate/not-in-dictionary) does not dismiss the seed panel", () => {
    const rejected = submitGuess(initialGameState(), "zzznotaword", RANKS);
    expect(rejected.state.seedDismissed).toBe(false);
  });
});

describe("dismissSeedPanel", () => {
  test("sets seedDismissed true", () => {
    expect(dismissSeedPanel(initialGameState()).seedDismissed).toBe(true);
  });

  test("is idempotent (returns an equal state if already dismissed)", () => {
    const dismissed = dismissSeedPanel(initialGameState());
    expect(dismissSeedPanel(dismissed)).toEqual(dismissed);
  });
});

describe("bestRank", () => {
  test("undefined with no guesses", () => {
    expect(bestRank(initialGameState())).toBeUndefined();
  });

  test("the minimum rank across all guesses", () => {
    let state = submitGuess(initialGameState(), "banana", RANKS).state;
    state = submitGuess(state, "recharge", RANKS).state;
    expect(bestRank(state)).toBe(3);
  });
});

describe("determinism", () => {
  // Requirement 12's deterministic test: given a fixed target-day ranks table
  // and a fixed sequence of raw guesses, the final state must be
  // byte-identical every time this runs, since submitGuess has no I/O, no
  // randomness, and no wall-clock reads.
  const GUESS_SEQUENCE = ["charge", "Recharge!", "recharge", "unknownword", "battery", "banana"];

  function runSequence(): GameState {
    let state = initialGameState();
    for (const raw of GUESS_SEQUENCE) {
      state = submitGuess(state, raw, RANKS).state;
    }
    return state;
  }

  test("the same sequence produces byte-identical JSON across independent runs", () => {
    const first = JSON.stringify(runSequence());
    const second = JSON.stringify(runSequence());
    const third = JSON.stringify(runSequence());
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  test("the deterministic final state has the expected shape", () => {
    // charge (added) -> recharge (added) -> recharge again (duplicate, no-op)
    // -> unknownword (not-in-dictionary, no-op) -> battery (rank 1, wins) ->
    // banana (after win, no-op per the win guard).
    const final = runSequence();
    expect(final).toEqual({
      guesses: [
        { word: "charge", rank: 2 },
        { word: "recharge", rank: 3 },
        { word: "battery", rank: 1 },
      ],
      won: true,
      seedDismissed: true,
    });
  });
});
