import {
  announcementForAdded,
  announcementForDuplicate,
  announcementForLost,
  announcementForNotInDictionary,
} from "./announce";

describe("announcementForAdded", () => {
  test("rank 1 announces the win, no temperature word appended", () => {
    expect(announcementForAdded("battery", 1)).toBe("battery, rank 1, exact match, solved");
  });

  test("matches the exact kickoff example shape (category + attribute + temperature)", () => {
    // Note: the kickoff's own prose example paired rank 47 with "warm", but
    // its own stated mapping (2-100 -> hot) says 47 should be "hot". The
    // numeric mapping is treated as authoritative; see announce.ts's
    // "DISCREPANCY FLAGGED" comment.
    expect(announcementForAdded("hunter", 47, "tool", "both used in hunting")).toBe(
      "hunter, rank 47, category tool, attribute: both used in hunting, hot",
    );
  });

  test("omits category when not provided", () => {
    expect(announcementForAdded("hunter", 47, undefined, "both used in hunting")).toBe(
      "hunter, rank 47, attribute: both used in hunting, hot",
    );
  });

  test("omits attribute when not provided", () => {
    expect(announcementForAdded("hunter", 47, "tool")).toBe("hunter, rank 47, category tool, hot");
  });

  test("omits both when neither is provided", () => {
    expect(announcementForAdded("hunter", 47)).toBe("hunter, rank 47, hot");
  });

  describe("temperature word bands", () => {
    test("2-100 is hot, including both boundaries", () => {
      expect(announcementForAdded("w", 2)).toMatch(/hot$/);
      expect(announcementForAdded("w", 100)).toMatch(/hot$/);
    });

    test("101-1000 is warm, including both boundaries", () => {
      expect(announcementForAdded("w", 101)).toMatch(/warm$/);
      expect(announcementForAdded("w", 1000)).toMatch(/warm$/);
    });

    test("1001+ is cold, unbounded above", () => {
      expect(announcementForAdded("w", 1001)).toMatch(/cold$/);
      expect(announcementForAdded("w", 999_999)).toMatch(/cold$/);
    });
  });
});

describe("announcementForDuplicate", () => {
  test("names the word", () => {
    expect(announcementForDuplicate("sink")).toBe("sink, already guessed");
  });
});

describe("announcementForNotInDictionary", () => {
  test("names the word", () => {
    expect(announcementForNotInDictionary("zzz")).toBe("zzz, not in dictionary");
  });
});

describe("announcementForLost", () => {
  test("prefixes the tiered lose message", () => {
    expect(announcementForLost("Tough one today. See you tomorrow, we all get one.")).toBe(
      "Out of guesses. Tough one today. See you tomorrow, we all get one.",
    );
  });
});
