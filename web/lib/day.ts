/**
 * Day-number resolver.
 *
 * CLAUDE.md's determinism rule: day numbering must never depend on the
 * client's timezone in a way that changes which puzzle is served. This
 * resolver anchors both "today" and the launch epoch to UTC calendar days, so
 * every player worldwide rolls over to the next puzzle at the same instant
 * (UTC midnight) rather than at their own local midnight. The tradeoff is
 * that the rollover happens at a different local hour depending on timezone;
 * that is accepted here in favor of a single unambiguous day number, which is
 * what "same puzzle for everyone" in CLAUDE.md actually requires.
 *
 * Not one of the four decisions the user asked to be consulted on, so this is
 * a sensible-default judgment call, documented here rather than asked about.
 */

export const LAUNCH_EPOCH = "2026-09-15";

/** Midnight UTC of a `YYYY-MM-DD` date string, as epoch milliseconds. */
function utcMidnight(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year as number, (month as number) - 1, day as number);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve the puzzle day number for `now`, anchored to `launchEpoch` (day 1).
 * Clamped to [1, maxDay] so a clock before launch or past the last generated
 * puzzle still resolves to a playable day instead of a missing file. Phase 2
 * only has day1..day60; extending the clamp ceiling is a pipeline rerun, not a
 * web/ change (see POSTLAUNCH.md for the "day beyond generated range" UX).
 */
export function resolveDayNumber(
  now: Date,
  launchEpoch: string = LAUNCH_EPOCH,
  maxDay: number = 60,
): number {
  const todayUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const epochMidnight = utcMidnight(launchEpoch);
  const diffDays = Math.floor((todayUtcMidnight - epochMidnight) / MS_PER_DAY);
  const day = diffDays + 1; // day 1 = launch epoch
  return Math.min(Math.max(day, 1), maxDay);
}

/**
 * Dev/testing convenience, added on request: reads an optional `?day=N`
 * query-string override so a specific generated day can be previewed
 * (e.g. `localhost:3000/?day=15`) without moving the system clock. Not a
 * shipped feature: no UI links to it, it doesn't appear in the four Phase 2
 * design decisions, and it never changes the persisted state key format
 * (a day visited this way still saves to `conceptle:day:15:state` like any
 * other day). Returns null when the param is absent or out of range, in
 * which case the caller should fall back to resolveDayNumber.
 */
export function parseDayOverride(search: string, maxDay: number = 60): number | null {
  const raw = new URLSearchParams(search).get("day");
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxDay) return null;
  return parsed;
}
