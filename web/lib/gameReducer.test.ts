import {
  MAX_GUESSES,
  bestRank,
  dismissProbePanel,
  guessesRemaining,
  initialGameState,
  isGameOver,
  isLost,
  submitGuess,
  submitProbe,
  type DayData,
  type GameState,
} from "./gameReducer";

const RANKS = { battery: 1, charge: 2, recharge: 3, banana: 15432, apple: 3000 };
const DAY: DayData = { ranks: RANKS, forms: {}, categories: {}, attributes: {} };

// Phase 1.5.1: surface-form -> lemma map, and a ranks table matching the
// user-provided test cases (day 15's real "hunter" -> rank 10, plus
// run/cat for the "running"/"cats" cases).
const FORMS = { hunters: "hunter", running: "run", cats: "cat" };
const RANKS_WITH_LEMMAS = { hunter: 10, run: 87, cat: 4 };
const DAY_WITH_LEMMAS: DayData = { ranks: RANKS_WITH_LEMMAS, forms: FORMS, categories: {}, attributes: {} };

// Phase 2.5 / 2.5.1: category/attribute lookups. Category threshold is
// 2500 as of Phase 2.5.1 (raised from 500); apple's rank 3000 is chosen to
// sit just past that, for the "hidden" case.
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

  test("category is attached when rank <= 2500 (Phase 2.5.1 threshold)", () => {
    const nearCategory = { ranks: { close: 2400 }, forms: {}, categories: { close: "tool" }, attributes: {} };
    const result = submitGuess(initialGameState(), "close", nearCategory);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.category).toBe("tool");
  });

  test("category is omitted when rank > 2500 even if categories.json has an entry", () => {
    const result = submitGuess(initialGameState(), "apple", DAY_WITH_METADATA);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses[0]?.rank).toBe(3000);
    expect(result.state.guesses[0]?.category).toBeUndefined();
  });

  // The exact boundary pair named in the Phase 2.5.1 kickoff's test list.
  test("category renders at rank 2400, does not render at rank 2600", () => {
    const boundaryDay: DayData = {
      ranks: { hits: 2400, misses: 2600 },
      forms: {},
      categories: { hits: "tool", misses: "tool" },
      attributes: {},
    };
    const hit = submitGuess(initialGameState(), "hits", boundaryDay);
    const missState = submitGuess(initialGameState(), "misses", boundaryDay);
    if (hit.kind !== "added" || missState.kind !== "added") throw new Error("unreachable");
    expect(hit.state.guesses[0]?.category).toBe("tool");
    expect(missState.state.guesses[0]?.category).toBeUndefined();
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

describe("submitProbe (Phase 2.5.1 Fix B)", () => {
  const PROBE_DAY: DayData = {
    ranks: { animal: 3, place: 40, tool: 900, feeling: 12000 },
    forms: {},
    categories: { animal: "animal" },
    attributes: { place: "both are locations" },
  };

  test("adds a probe to `probes`, not `guesses`, and does not touch guessesRemaining", () => {
    const result = submitProbe(initialGameState(), "animal", PROBE_DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.probes).toEqual([{ word: "animal", rank: 3, category: "animal", attribute: undefined }]);
    expect(result.state.guesses).toHaveLength(0);
    expect(guessesRemaining(result.state)).toBe(MAX_GUESSES);
    expect(result.band).toBe("bright-green");
  });

  test("a probe gets category/attribute exactly like a real guess would", () => {
    const result = submitProbe(initialGameState(), "place", PROBE_DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.probes[0]?.attribute).toBe("both are locations");
  });

  test("each probe word can be used at most once: a second submission of the same word is rejected", () => {
    const afterFirst = submitProbe(initialGameState(), "animal", PROBE_DAY).state;
    const result = submitProbe(afterFirst, "animal", PROBE_DAY);
    expect(result.kind).toBe("already-used");
    expect(result.state).toEqual(afterFirst);
    expect(result.state.probes).toHaveLength(1);
  });

  test("different probe words can each be used once, independently", () => {
    let state = submitProbe(initialGameState(), "animal", PROBE_DAY).state;
    state = submitProbe(state, "place", PROBE_DAY).state;
    expect(state.probes.map((p) => p.word)).toEqual(["animal", "place"]);
  });

  test("a probe word not in today's ranks is not-in-dictionary and not recorded", () => {
    const start = initialGameState();
    const result = submitProbe(start, "feeling", { ranks: {}, forms: {}, categories: {}, attributes: {} });
    expect(result.kind).toBe("not-in-dictionary");
    expect(result.state).toEqual(start);
  });

  test("a probe landing rank 1 still wins the game", () => {
    const result = submitProbe(initialGameState(), "animal", { ranks: { animal: 1 }, forms: {}, categories: {}, attributes: {} });
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.won).toBe(true);
  });

  test("probes are excluded from the share string (checked at the share.ts layer: only guesses are ever passed to buildShareString)", () => {
    // This is really an integration invariant enforced by call sites
    // (Game.tsx passes game.guesses, never game.probes, to buildShareString);
    // documented here since it's a Phase 2.5.1 requirement, and see
    // lib/share.test.ts for the string-building behavior itself.
    const result = submitProbe(initialGameState(), "animal", PROBE_DAY);
    expect(result.kind).toBe("added");
    if (result.kind !== "added") throw new Error("unreachable");
    expect(result.state.guesses).toHaveLength(0); // nothing here for a share string to pick up
  });
});

describe("dismissProbePanel", () => {
  test("sets probePanelDismissed true", () => {
    expect(dismissProbePanel(initialGameState()).probePanelDismissed).toBe(true);
  });

  test("is idempotent (returns an equal state if already dismissed)", () => {
    const dismissed = dismissProbePanel(initialGameState());
    expect(dismissProbePanel(dismissed)).toEqual(dismissed);
  });
});

describe("bestRank", () => {
  test("undefined with nothing guessed or probed", () => {
    expect(bestRank(initialGameState())).toBeUndefined();
  });

  test("the minimum rank across all real guesses", () => {
    let state = submitGuess(initialGameState(), "banana", DAY).state;
    state = submitGuess(state, "recharge", DAY).state;
    expect(bestRank(state)).toBe(3);
  });

  test("includes probes: a probe's rank can set the best, per the kickoff's 'exactly like a real guess' framing", () => {
    const probeDay: DayData = { ranks: { animal: 2 }, forms: {}, categories: {}, attributes: {} };
    let state = submitGuess(initialGameState(), "banana", DAY).state;
    state = submitProbe(state, "animal", probeDay).state;
    expect(bestRank(state)).toBe(2);
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
      version: 3,
      guesses: [
        { word: "charge", rank: 2, category: undefined, attribute: "both involve electricity" },
        { word: "recharge", rank: 3, category: undefined, attribute: undefined },
        { word: "battery", rank: 1, category: "appliance", attribute: undefined },
      ],
      probes: [],
      probePanelDismissed: false,
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

  test("a sequence of probes followed by guesses is also byte-identical across runs", () => {
    const mixedDay: DayData = {
      ranks: { animal: 40, place: 900, battery: 1 },
      forms: {},
      categories: {},
      attributes: {},
    };
    function run(): GameState {
      let state = initialGameState();
      state = submitProbe(state, "animal", mixedDay).state;
      state = submitProbe(state, "place", mixedDay).state;
      state = submitGuess(state, "battery", mixedDay).state;
      return state;
    }
    const first = JSON.stringify(run());
    const second = JSON.stringify(run());
    expect(first).toBe(second);
    expect(run().probes).toHaveLength(2);
    expect(run().guesses).toHaveLength(1);
  });
});
