/**
 * Text for the ARIA live region after a guess is added. Phase 2.5 changed
 * the shape to include category/attribute, per the kickoff's exact example:
 * "hunter, rank 47, category tool, attribute: both used in hunting".
 *
 * This literal example has no v1-style temperature word ("hot"/"warm"/
 * "cool"/"cold"); v2 drops it in favor of the more concrete category and
 * attribute signal, which convey more than a generic temperature adjective
 * once they're available. Flagged in the Phase 2.5 report as a deliberate
 * read of "spec, not suggestion" against the literal example, since the
 * kickoff separately says accessibility is "unchanged from v1 but
 * re-verify" -- the two are in tension, and the exact quoted ARIA string
 * was treated as authoritative here.
 */
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
