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

describe("v2 round-trip", () => {
  test("a saved v2 state loads back exactly", () => {
    const state: GameState = {
      version: 2,
      guesses: [{ word: "battery", rank: 1 }],
      won: true,
    };
    saveGameState(1, state);
    expect(loadGameState(1)).toEqual(state);
  });

  test("loading a day with nothing saved returns null", () => {
    expect(loadGameState(99)).toBeNull();
  });
});

describe("v1 -> v2 migration (Phase 2.5)", () => {
  test("a v1-shaped save (seedDismissed, no version) is silently discarded", () => {
    const v1Shape = {
      guesses: [{ word: "battery", rank: 1 }],
      won: true,
      seedDismissed: true,
    };
    window.localStorage.setItem(storageKeyForDay(1), JSON.stringify(v1Shape));
    expect(loadGameState(1)).toBeNull();
  });

  test("malformed JSON is also discarded, not thrown", () => {
    window.localStorage.setItem(storageKeyForDay(1), "{not valid json");
    expect(loadGameState(1)).toBeNull();
  });

  test("a version field that isn't exactly 2 is discarded", () => {
    window.localStorage.setItem(storageKeyForDay(1), JSON.stringify({ version: 1, guesses: [], won: false }));
    expect(loadGameState(1)).toBeNull();
  });
});
