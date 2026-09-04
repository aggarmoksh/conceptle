import { lookupAttribute } from "./attributes";

describe("lookupAttribute", () => {
  const attributes = { cupboard: "both store food", freeze: "both involve low temperature" };

  test("returns the phrase for a present word", () => {
    expect(lookupAttribute("cupboard", attributes)).toBe("both store food");
  });

  test("returns undefined for a missing word (no attribute signal)", () => {
    expect(lookupAttribute("nonexistent", attributes)).toBeUndefined();
  });
});
