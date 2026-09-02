import { lookupRank, rankToBand, rankToThermometerPosition } from "./rank";

describe("rankToBand", () => {
  test("rank 1 is gold", () => {
    expect(rankToBand(1)).toBe("gold");
  });

  test("2-50 is bright-green, including both boundaries", () => {
    expect(rankToBand(2)).toBe("bright-green");
    expect(rankToBand(50)).toBe("bright-green");
  });

  test("51-300 is green, including both boundaries", () => {
    expect(rankToBand(51)).toBe("green");
    expect(rankToBand(300)).toBe("green");
  });

  test("301-1500 is yellow, including both boundaries", () => {
    expect(rankToBand(301)).toBe("yellow");
    expect(rankToBand(1500)).toBe("yellow");
  });

  test("1501+ is red, unbounded above", () => {
    expect(rankToBand(1501)).toBe("red");
    expect(rankToBand(999_999)).toBe("red");
  });
});

describe("lookupRank", () => {
  const ranks = { kitchen: 1, sink: 42 };

  test("returns the rank for a present word", () => {
    expect(lookupRank(ranks, "sink")).toBe(42);
  });

  test("returns undefined for a missing word", () => {
    expect(lookupRank(ranks, "nonexistent")).toBeUndefined();
  });
});

describe("rankToThermometerPosition", () => {
  test("rank 1 is position 1 (gold end)", () => {
    expect(rankToThermometerPosition(1)).toBe(1);
  });

  test("rank at the cap (10000) is position 0 (red end)", () => {
    expect(rankToThermometerPosition(10000)).toBe(0);
  });

  test("beyond the cap clamps to position 0, never negative", () => {
    expect(rankToThermometerPosition(50000)).toBe(0);
  });

  test("is monotonically decreasing as rank increases", () => {
    const p1 = rankToThermometerPosition(2);
    const p2 = rankToThermometerPosition(1000);
    const p3 = rankToThermometerPosition(9999);
    expect(p1).toBeGreaterThan(p2);
    expect(p2).toBeGreaterThan(p3);
  });
});
