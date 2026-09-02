/** The five rank bands, in best-to-worst order. Order matters for `<RankBand[]>`
 *  comparisons elsewhere (e.g. "is this a new best"). */
export type RankBand = "gold" | "bright-green" | "green" | "yellow" | "red";

/** CSS custom property name for each band's fill and text color, set in globals.css. */
export const RANK_BAND_COLORS: Record<RankBand, { fill: string; text: string }> = {
  gold: { fill: "var(--color-rank-gold)", text: "var(--color-rank-text)" },
  "bright-green": { fill: "var(--color-rank-bright-green)", text: "var(--color-rank-text)" },
  green: { fill: "var(--color-rank-green)", text: "var(--color-rank-text)" },
  yellow: { fill: "var(--color-rank-yellow)", text: "var(--color-rank-text)" },
  red: { fill: "var(--color-rank-red)", text: "var(--color-rank-text)" },
};

/** Spoken/ARIA word for a band, used by the live-region announcer. */
export const RANK_BAND_TEMPERATURE: Record<RankBand, string> = {
  gold: "exact match",
  "bright-green": "hot",
  green: "warm",
  yellow: "cool",
  red: "cold",
};

/**
 * Map a rank to its color band, per the thresholds specified in the Phase 2
 * kickoff: 1 = gold, 2-50 = bright green, 51-300 = green, 301-1500 = yellow,
 * 1501+ = red.
 */
export function rankToBand(rank: number): RankBand {
  if (rank <= 1) return "gold";
  if (rank <= 50) return "bright-green";
  if (rank <= 300) return "green";
  if (rank <= 1500) return "yellow";
  return "red";
}

/** Look up a normalized guess word's rank in today's puzzle. */
export function lookupRank(
  ranks: Record<string, number>,
  normalizedWord: string,
): number | undefined {
  return ranks[normalizedWord];
}

/**
 * Map a rank to a 0..1 position on the thermometer, gold end (1) at position
 * 1 and red end (10000+) at position 0. Logarithmic because rank spans
 * several orders of magnitude (1 to ~11000) and a linear scale would make
 * almost every realistic guess look indistinguishable from "worst".
 */
const THERMOMETER_RANK_CAP = 10000;

export function rankToThermometerPosition(rank: number): number {
  const clamped = Math.min(Math.max(rank, 1), THERMOMETER_RANK_CAP);
  const position = 1 - Math.log10(clamped) / Math.log10(THERMOMETER_RANK_CAP);
  return Math.min(Math.max(position, 0), 1);
}
