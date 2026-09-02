import { resolveDayNumber } from "./day";

const EPOCH = "2026-09-15";

describe("resolveDayNumber", () => {
  test("launch epoch midnight UTC is day 1", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 15, 0, 0, 0)), EPOCH)).toBe(1);
  });

  test("launch epoch just before midnight UTC is still day 1", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 15, 23, 59, 59)), EPOCH)).toBe(1);
  });

  test("the next UTC calendar day is day 2, regardless of local timezone offset", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 16, 0, 0, 1)), EPOCH)).toBe(2);
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 16, 23, 0, 0)), EPOCH)).toBe(2);
  });

  test("clamped to 1 before the launch epoch", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 1)), EPOCH)).toBe(1);
  });

  test("day 60 lands on the expected calendar date (epoch + 59 days)", () => {
    // Sept 15 + 59 days = Nov 13, 2026.
    expect(resolveDayNumber(new Date(Date.UTC(2026, 10, 13)), EPOCH)).toBe(60);
  });

  test("clamped to maxDay well beyond the generated range", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2027, 0, 1)), EPOCH, 60)).toBe(60);
  });

  test("respects a custom maxDay", () => {
    expect(resolveDayNumber(new Date(Date.UTC(2026, 8, 20)), EPOCH, 3)).toBe(3);
  });
});
