import { MAX_GUESSES, type GuessRecord } from "./gameReducer";

/**
 * Wordle-style share string. Deliberately a SEPARATE, coarser band system
 * from lib/rank.ts's rankToBand (5 bands: gold/bright-green/green/yellow/
 * red, used for in-app guess-row feedback): the share string is public,
 * copy-pasted text, so it uses its own 4-tier palette confirmed with the
 * user before implementation (purple for the exact answer; green/yellow/red
 * for everything else). The two systems are not meant to line up 1:1, and
 * this file never imports rankToBand.
 */
export function rankToShareEmoji(rank: number): string {
  if (rank <= 1) return "🟪";
  if (rank <= 100) return "🟩";
  if (rank <= 1000) return "🟨";
  return "🟥";
}

/**
 * Builds the copy-to-clipboard text. No category or attribute content ever
 * appears here (per spec: "no category/attribute leaks") -- only the day
 * number, guess count, and one emoji per guess.
 *
 * Squares: one per guess actually made, not padded to 6. A win in 4 shows 4
 * squares (mirrors Wordle's own convention of only showing rows for guesses
 * taken); a loss always shows 6 since all 6 were used to get there.
 *
 * Score line: "M/6" on a win (M = guesses used), literally "X/6" on a loss
 * (Wordle's own convention for a failed puzzle, not a guess count).
 */
export function buildShareString(day: number, guesses: GuessRecord[], won: boolean): string {
  const scoreLine = won ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const squares = guesses.map((g) => rankToShareEmoji(g.rank)).join("");
  return `Conceptle #${day}  ${scoreLine}\n${squares}\nconceptle.com`;
}
