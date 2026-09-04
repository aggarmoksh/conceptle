import { loadGameState, saveGameState, storageKeyForDay } from "./storage";
import type { GameState } from "./gameReducer";

beforeEach(() => {
  window.localStorage.clear();
});

describe("storageKeyForDay", () => {
  test("matches the documented key format", () => {
    expect(storageKeyForDay(42)).toBe("conceptle:day:42:state");
  });
});

describe("v3 round-trip", () => {
  test("a saved v3 state loads back exactly", () => {
    const state: GameState = {
      version: 3,
      guesses: [{ word: "battery", rank: 1 }],
      probes: [{ word: "animal", rank: 40 }],
      probePanelDismissed: true,
      won: true,
    };
    saveGameState(1, state);
    expect(loadGameState(1)).toEqual(state);
  });

  test("loading a day with nothing saved returns null", () => {
    expect(loadGameState(99)).toBeNull();
  });
});

describe("schema migration (silently discard on any mismatch)", () => {
  test("a v1-shaped save (seedDismissed, no version) is silently discarded", () => {
    const v1Shape = {
      guesses: [{ word: "battery", rank: 1 }],
      won: true,
      seedDismissed: true,
    };
    window.localStorage.setItem(storageKeyForDay(1), JSON.stringify(v1Shape));
    expect(loadGameState(1)).toBeNull();
  });

  test("a v2-shaped save (version: 2, no probes/probePanelDismissed) is silently discarded", () => {
    const v2Shape = {
      version: 2,
      guesses: [{ word: "battery", rank: 1 }],
      won: true,
    };
    window.localStorage.setItem(storageKeyForDay(1), JSON.stringify(v2Shape));
    expect(loadGameState(1)).toBeNull();
  });

  test("malformed JSON is also discarded, not thrown", () => {
    window.localStorage.setItem(storageKeyForDay(1), "{not valid json");
    expect(loadGameState(1)).toBeNull();
  });

  test("a version field that isn't exactly 3 is discarded", () => {
    window.localStorage.setItem(
      storageKeyForDay(1),
      JSON.stringify({ version: 4, guesses: [], probes: [], probePanelDismissed: false, won: false }),
    );
    expect(loadGameState(1)).toBeNull();
  });
});
