import { normalizeGuess } from "./guess";

describe("normalizeGuess", () => {
  test("trims, lowercases, and strips punctuation", () => {
    expect(normalizeGuess("  Kitchen! ")).toBe("kitchen");
  });

  test("strips hyphens and digits, keeps letters only", () => {
    expect(normalizeGuess("well-known123")).toBe("wellknown");
  });

  test("all-symbol input normalizes to empty string", () => {
    expect(normalizeGuess("123!!!")).toBe("");
  });

  test("already-normalized input is unchanged", () => {
    expect(normalizeGuess("battery")).toBe("battery");
  });

  test("mixed case with internal spaces strips the spaces too", () => {
    expect(normalizeGuess("New York")).toBe("newyork");
  });
});
