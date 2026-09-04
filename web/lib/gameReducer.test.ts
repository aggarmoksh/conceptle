import {
  MAX_GUESSES,
  bestRank,
  guessesRemaining,
  initialGameState,
  isGameOver,
  isLost,
  submitGuess,
  type DayData,
  type GameState,
} from "./gameReducer";

const RANKS = { battery: 1, charge: 2, recharge: 3, banana: 15432, apple: 600 };
const DAY: DayData = { ranks: RANKS, forms: {}, categories: {}, attributes: {} };

// Phase 1.5.1: surface-form -> lemma map, and a ranks table matching the
// user-provided test cases (day 15's real "hunter" -> rank 10, plus
// run/cat for the "running"/"cats" cases).
const FORMS = { hunters: "hunter", running: "run", cats: "cat" };
const RANKS_WITH_LEMMAS = { hunter: 10, run: 87, cat: 4 };
const DAY_WITH_LEMMAS: DayData = { ranks: RANKS_WITH_LEMMAS, forms: FORMS, categories: {}, attributes: {} };

// Phase 2.5: category/attribute lookups.
const CATEGORIES = { battery: "appliance", apple: "food" };
const ATTRIBUTES = { charge: "both involve electricity" };
const DAY_WITH_METADATA: DayData = { ranks: RANKS, forms: {}, categories: CATEGORIES, attributes: ATTRIBUTES };

describe("submitGuess", () => {
  test("adds a new valid guess and reports its band", () => {
    const result = submitGuess(initialGameState(), "charge", DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses).toEqual([{ word: "charge", rank: 2, category: undefined, attribute: undefined }]);
    expect(result.band).toBe("bright-green");
    expect(result.state.won).toBe(false);
  });

  test("normalizes the raw guess before lookup", () => {
    const result = submitGuess(initialGameState(), "  Charge! ", DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.word).toBe("charge");
  });

  test("guessing the rank-1 word wins", () => {
    const result = submitGuess(initialGameState(), "battery", DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.won).toBe(true);
    expect(result.band).toBe("gold");
  });

  test("a duplicate guess is rejected and state is unchanged", () => {
    const afterFirst = submitGuess(initialGameState(), "charge", DAY).state;
    const result = submitGuess(afterFirst, "charge", DAY);
    expect(result.kind).toBe("duplicate");
    expect(result.state).toEqual(afterFirst);
    expect(result.state.guesses).toHaveLength(1);
  });

  test("a word not in today's ranks is rejected and state is unchanged", () => {
    const start = initialGameState();
    const result = submitGuess(start, "zzznotaword", DAY);
    expect(result.kind).toBe("not-in-dictionary");
    expect(result.state).toEqual(start);
  });

  test("an empty-after-normalizing guess is a no-op", () => {
    const start = initialGameState();
    const result = submitGuess(start, "!!!", DAY);
    expect(result.kind).toBe("empty");
    expect(result.state).toEqual(start);
  });

  test("once won, further submissions are no-ops", () => {
    const won = submitGuess(initialGameState(), "battery", DAY).state;
    const result = submitGuess(won, "charge", DAY);
    expect(result.kind).toBe("empty");
    expect(result.state).toEqual(won);
    expect(result.state.guesses).toHaveLength(1);
  });

  test("category is attached only when rank <= 500", () => {
    // battery: rank 1 (<=500) -> category shown, but it also wins, so use
    // apple (rank 600, > 500) and charge-adjacent words to check the gate.
    const nearCategory = { ranks: { close: 50 }, forms: {}, categories: { close: "tool" }, attributes: {} };
    const result = submitGuess(initialGameState(), "close", nearCategory);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.category).toBe("tool");
  });

  test("category is omitted when rank > 500 even if categories.json has an entry", () => {
    const result = submitGuess(initialGameState(), "apple", DAY_WITH_METADATA);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.rank).toBe(600);
    expect(result.state.guesses[0]?.category).toBeUndefined();
  });

  test("attribute is attached when present, regardless of category visibility", () => {
    const result = submitGuess(initialGameState(), "charge", DAY_WITH_METADATA);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.attribute).toBe("both involve electricity");
  });

  test("category and attribute are both undefined when absent from the maps", () => {
    const result = submitGuess(initialGameState(), "recharge", DAY_WITH_METADATA);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.category).toBeUndefined();
    expect(result.state.guesses[0]?.attribute).toBeUndefined();
  });
});

describe("the 6-guess hard cap (Phase 2.5)", () => {
  const NEVER_RIGHT_RANKS = { one: 5000, two: 5001, three: 5002, four: 5003, five: 5004, six: 5005, seven: 5006 };
  const NEVER_RIGHT_DAY: DayData = { ranks: NEVER_RIGHT_RANKS, forms: {}, categories: {}, attributes: {} };
  const WRONG_GUESSES = ["one", "two", "three", "four", "five", "six"];

  function playWrongGuesses(count: number): GameState {
    let state = initialGameState();
    for (let i = 0; i < count; i++) {
      state = submitGuess(state, WRONG_GUESSES[i]!, NEVER_RIGHT_DAY).state;
    }
    return state;
  }

  test("guessesRemaining counts down from MAX_GUESSES", () => {
    expect(guessesRemaining(initialGameState())).toBe(MAX_GUESSES);
    expect(guessesRemaining(playWrongGuesses(1))).toBe(MAX_GUESSES - 1);
    expect(guessesRemaining(playWrongGuesses(6))).toBe(0);
  });

  test("is not lost or game-over before the 6th wrong guess", () => {
    const afterFive = playWrongGuesses(5);
    expect(isLost(afterFive)).toBe(false);
    expect(isGameOver(afterFive)).toBe(false);
  });

  test("the 6th wrong guess triggers the lose state", () => {
    const afterSix = playWrongGuesses(6);
    expect(afterSix.won).toBe(false);
    expect(isLost(afterSix)).toBe(true);
    expect(isGameOver(afterSix)).toBe(true);
    expect(afterSix.guesses).toHaveLength(6);
  });

  test("a 7th submission after losing is a no-op, same as after winning", () => {
    const lost = playWrongGuesses(6);
    const result = submitGuess(lost, "seven", NEVER_RIGHT_DAY);
    expect(result.kind).toBe("empty");
    expect(result.state).toEqual(lost);
    expect(result.state.guesses).toHaveLength(6);
  });

  test("winning on the 6th guess is a win, not a loss", () => {
    const winningDay: DayData = {
      ranks: { one: 5000, two: 5001, three: 5002, four: 5003, five: 5004, battery: 1 },
      forms: {},
      categories: {},
      attributes: {},
    };
    let state = initialGameState();
    for (const word of ["one", "two", "three", "four", "five"]) {
      state = submitGuess(state, word, winningDay).state;
    }
    const result = submitGuess(state, "battery", winningDay);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.won).toBe(true);
    expect(isLost(result.state)).toBe(false);
    expect(result.state.guesses).toHaveLength(6);
  });
});

describe("bestRank", () => {
  test("undefined with no guesses", () => {
    expect(bestRank(initialGameState())).toBeUndefined();
  });

  test("the minimum rank across all guesses", () => {
    let state = submitGuess(initialGameState(), "banana", DAY).state;
    state = submitGuess(state, "recharge", DAY).state;
    expect(bestRank(state)).toBe(3);
  });
});

describe("submitGuess with forms.json lemma resolution (Phase 1.5.1)", () => {
  // The six required test cases from the Phase 1.5.1 kickoff.

  test('"hunters" resolves via forms.json to hunter\'s rank (10)', () => {
    const result = submitGuess(initialGameState(), "hunters", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]).toMatchObject({ word: "hunters", rank: 10 });
  });

  test('"running" resolves to run\'s rank', () => {
    const result = submitGuess(initialGameState(), "running", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]).toMatchObject({ word: "running", rank: 87 });
  });

  test('"cats" resolves to cat\'s rank', () => {
    const result = submitGuess(initialGameState(), "cats", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]).toMatchObject({ word: "cats", rank: 4 });
  });

  test('"asdfgh" (no lemma mapping, not in ranks) is not-in-dictionary', () => {
    const result = submitGuess(initialGameState(), "asdfgh", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("not-in-dictionary");
  });

  test('"hunter" (the lemma itself) still works exactly as before', () => {
    const result = submitGuess(initialGameState(), "hunter", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]).toMatchObject({ word: "hunter", rank: 10 });
  });

  test('guessing "hunter" then "hunters" triggers duplicate on the second', () => {
    const afterFirst = submitGuess(initialGameState(), "hunter", DAY_WITH_LEMMAS).state;
    const result = submitGuess(afterFirst, "hunters", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("duplicate");
    expect(result.state.guesses).toHaveLength(1);
  });

  test('the reverse order ("hunters" then "hunter") also dedupes', () => {
    const afterFirst = submitGuess(initialGameState(), "hunters", DAY_WITH_LEMMAS).state;
    const result = submitGuess(afterFirst, "hunter", DAY_WITH_LEMMAS);
    expect(result.kind).toBe("duplicate");
    expect(result.state.guesses).toHaveLength(1);
  });

  test("with an empty forms map, behavior is unchanged: exact match only", () => {
    // hunters is not itself a key in RANKS_WITH_LEMMAS, and no forms map is
    // supplied, so it must fail exactly like the pre-1.5.1 behavior.
    const noForms: DayData = { ranks: RANKS_WITH_LEMMAS, forms: {}, categories: {}, attributes: {} };
    const result = submitGuess(initialGameState(), "hunters", noForms);
    expect(result.kind).toBe("not-in-dictionary");
  });
});

describe("determinism", () => {
  // Requirement 12's deterministic test: given a fixed target-day puzzle
  // bundle and a fixed sequence of raw guesses, the final state must be
  // byte-identical every time this runs, since submitGuess has no I/O, no
  // randomness, and no wall-clock reads.
  const GUESS_SEQUENCE = ["charge", "Recharge!", "recharge", "unknownword", "battery", "banana"];

  function runSequence(): GameState {
    let state = initialGameState();
    for (const raw of GUESS_SEQUENCE) {
      state = submitGuess(state, raw, DAY_WITH_METADATA).state;
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
    // banana (after win, no-op per the game-over guard).
    const final = runSequence();
    expect(final).toEqual({
      version: 2,
      guesses: [
        { word: "charge", rank: 2, category: undefined, attribute: "both involve electricity" },
        { word: "recharge", rank: 3, category: undefined, attribute: undefined },
        { word: "battery", rank: 1, category: "appliance", attribute: undefined },
      ],
      won: true,
    });
  });

  test("a full 6-guess losing sequence is also byte-identical across runs", () => {
    const losingDay: DayData = {
      ranks: { a: 5000, b: 5001, c: 5002, d: 5003, e: 5004, f: 5005 },
      forms: {},
      categories: {},
      attributes: {},
    };
    function runLosingSequence(): GameState {
      let state = initialGameState();
      for (const word of ["a", "b", "c", "d", "e", "f"]) {
        state = submitGuess(state, word, losingDay).state;
      }
      return state;
    }
    const first = JSON.stringify(runLosingSequence());
    const second = JSON.stringify(runLosingSequence());
    expect(first).toBe(second);
    expect(isLost(runLosingSequence())).toBe(true);
  });
});
