/**
 * Tiered lose-state message, keyed off the player's best rank across all 6
 * guesses. Exact wording and thresholds per the Phase 2.5 kickoff spec.
 */
export function loseMessageForBestRank(best: number): string {
  if (best <= 10) {
    return `So close, your best was rank ${best}. Come back tomorrow.`;
  }
  if (best <= 100) {
    return `Almost had it, your best was rank ${best}. See you tomorrow.`;
  }
  return "Tough one today. See you tomorrow, we all get one.";
}
