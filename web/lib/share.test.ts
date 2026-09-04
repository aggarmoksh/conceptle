import { buildShareString, rankToShareEmoji } from "./share";
import type { GuessRecord } from "./gameReducer";

describe("rankToShareEmoji", () => {
  test("rank 1 is purple", () => {
    expect(rankToShareEmoji(1)).toBe("🟪");
  });

  test("2-100 is green, including both boundaries", () => {
    expect(rankToShareEmoji(2)).toBe("🟩");
    expect(rankToShareEmoji(100)).toBe("🟩");
  });

  test("101-1000 is yellow, including both boundaries", () => {
    expect(rankToShareEmoji(101)).toBe("🟨");
    expect(rankToShareEmoji(1000)).toBe("🟨");
  });

  test("1001+ is red, unbounded above", () => {
    expect(rankToShareEmoji(1001)).toBe("🟥");
    expect(rankToShareEmoji(999_999)).toBe("🟥");
  });
});

describe("buildShareString", () => {
  function guess(rank: number): GuessRecord {
    return { word: "x", rank };
  }

  test("solved state: score line is M/6, one square per guess actually made", () => {
    const guesses = [guess(5000), guess(200), guess(50), guess(1)];
    const text = buildShareString(42, guesses, true);
    expect(text).toBe("Conceptle #42  4/6\n🟥🟨🟩🟪\nconceptle.com");
  });

  test("solved on the first guess: one square, 1/6", () => {
    const text = buildShareString(1, [guess(1)], true);
    expect(text).toBe("Conceptle #1  1/6\n🟪\nconceptle.com");
  });

  test("failed state: score line is literally X/6, all 6 squares shown", () => {
    const guesses = [guess(5000), guess(6000), guess(7000), guess(8000), guess(9000), guess(9500)];
    const text = buildShareString(7, guesses, false);
    expect(text).toBe("Conceptle #7  X/6\n🟥🟥🟥🟥🟥🟥\nconceptle.com");
  });

  test("never leaks a category or attribute even if present on the guess records", () => {
    const guesses: GuessRecord[] = [{ word: "hunter", rank: 10, category: "person", attribute: "both hunt" }];
    const text = buildShareString(1, guesses, true);
    expect(text).not.toContain("person");
    expect(text).not.toContain("both hunt");
    expect(text).not.toContain("hunter");
  });

  test("always ends with the conceptle.com line", () => {
    expect(buildShareString(1, [guess(1)], true)).toMatch(/conceptle\.com$/);
  });
});
