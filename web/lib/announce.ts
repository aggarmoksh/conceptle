/**
 * Text for the ARIA live region after a guess is added.
 *
 * v2.1 restores a temperature word, per an explicit follow-up to Phase 2.5
 * (which had dropped it): "hunter, rank 47, category tool, attribute: both
 * used in hunting, warm." This is a THIRD distinct rank-band system,
 * deliberately not reusing either existing one:
 *   - lib/rank.ts's rankToBand (5 tiers: 1 / 2-50 / 51-300 / 301-1500 /
 *     1501+) drives the in-app guess-row color.
 *   - lib/share.ts's rankToShareEmoji (4 tiers: 1 / 2-100 / 101-1000 /
 *     1001+) drives the public share-string squares.
 *   - temperatureForRank below (4 tiers, SAME thresholds as the share
 *     bands but different words: perfect / hot / warm / cold) drives only
 *     the spoken ARIA temperature word.
 * temperatureForRank happens to share its thresholds with rankToShareEmoji,
 * but is kept as its own function rather than imported from lib/share.ts:
 * the two encode different things (a word vs. an emoji) for different
 * audiences, and coupling them would make a future change to either one
 * silently affect the other.
 *
 * DISCREPANCY FLAGGED, not silently resolved: the follow-up's own example
 * ("hunter, rank 47, ..., warm") contradicts its own stated mapping
 * (rank 2-100 -> hot; 47 falls in that range and should say "hot"). The
 * numeric mapping was treated as authoritative here since a threshold rule
 * is more precise than a prose example likely to have a copy-paste slip;
 * temperatureForRank(47) below returns "hot", not "warm". Flag for
 * confirmation that this is the intended resolution.
 */
function temperatureForRank(rank: number): string {
  if (rank <= 1) return "perfect";
  if (rank <= 100) return "hot";
  if (rank <= 1000) return "warm";
  return "cold";
}

export function announcementForAdded(
  word: string,
  rank: number,
  category?: string,
  attribute?: string,
): string {
  if (rank === 1) return `${word}, rank 1, exact match, solved`;
  let text = `${word}, rank ${rank}`;
  if (category) text += `, category ${category}`;
  if (attribute) text += `, attribute: ${attribute}`;
  text += `, ${temperatureForRank(rank)}`;
  return text;
}

export function announcementForDuplicate(word: string): string {
  return `${word}, already guessed`;
}

export function announcementForNotInDictionary(word: string): string {
  return `${word}, not in dictionary`;
}

/** Failed state announced clearly (v2 requirement): reuses the exact same
 *  tiered message shown visually, so the spoken and visible text never say
 *  two different things. */
export function announcementForLost(loseMessage: string): string {
  return `Out of guesses. ${loseMessage}`;
}
