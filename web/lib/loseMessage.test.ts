import { loseMessageForBestRank } from "./loseMessage";

describe("loseMessageForBestRank", () => {
  test("1-10: 'so close' tier, including both boundaries", () => {
    expect(loseMessageForBestRank(1)).toBe("So close, your best was rank 1. Come back tomorrow.");
    expect(loseMessageForBestRank(10)).toBe("So close, your best was rank 10. Come back tomorrow.");
  });

  test("11-100: 'almost had it' tier, including both boundaries", () => {
    expect(loseMessageForBestRank(11)).toBe("Almost had it, your best was rank 11. See you tomorrow.");
    expect(loseMessageForBestRank(100)).toBe("Almost had it, your best was rank 100. See you tomorrow.");
  });

  test("101+: 'tough one' tier, unbounded above, no rank number in the message", () => {
    expect(loseMessageForBestRank(101)).toBe("Tough one today. See you tomorrow, we all get one.");
    expect(loseMessageForBestRank(999_999)).toBe("Tough one today. See you tomorrow, we all get one.");
  });
});
