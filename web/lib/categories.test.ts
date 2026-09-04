import { CATEGORY_VISIBILITY_RANK_THRESHOLD, lookupCategory, shouldShowCategory } from "./categories";

describe("shouldShowCategory", () => {
  test("true at and below the threshold (2500, raised from 500 in Phase 2.5.1)", () => {
    expect(shouldShowCategory(1)).toBe(true);
    expect(shouldShowCategory(2500)).toBe(true);
  });

  test("false above the threshold", () => {
    expect(shouldShowCategory(2501)).toBe(false);
    expect(shouldShowCategory(999_999)).toBe(false);
  });

  test("threshold constant is 2500, matching the Phase 2.5.1 kickoff", () => {
    expect(CATEGORY_VISIBILITY_RANK_THRESHOLD).toBe(2500);
  });

  // The exact pair named in the Phase 2.5.1 kickoff's test list.
  test("rank 2400 shows, rank 2600 does not", () => {
    expect(shouldShowCategory(2400)).toBe(true);
    expect(shouldShowCategory(2600)).toBe(false);
  });
});

describe("lookupCategory", () => {
  const categories = { refrigerator: "appliance", cat: "animal" };

  test("returns the category for a present word", () => {
    expect(lookupCategory("refrigerator", categories)).toBe("appliance");
  });

  test("returns undefined for a missing word", () => {
    expect(lookupCategory("nonexistent", categories)).toBeUndefined();
  });
});
