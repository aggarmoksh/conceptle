import { CATEGORY_VISIBILITY_RANK_THRESHOLD, lookupCategory, shouldShowCategory } from "./categories";

describe("shouldShowCategory", () => {
  test("true at and below the threshold (500)", () => {
    expect(shouldShowCategory(1)).toBe(true);
    expect(shouldShowCategory(500)).toBe(true);
  });

  test("false above the threshold", () => {
    expect(shouldShowCategory(501)).toBe(false);
    expect(shouldShowCategory(999_999)).toBe(false);
  });

  test("threshold constant is 500, matching the kickoff spec", () => {
    expect(CATEGORY_VISIBILITY_RANK_THRESHOLD).toBe(500);
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
