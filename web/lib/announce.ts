import { RANK_BAND_TEMPERATURE, rankToBand } from "./rank";

/** Text for the ARIA live region after a guess is added, e.g.
 *  "kitchen, rank 6, warm" (requirement 10's exact example shape). */
export function announcementForAdded(word: string, rank: number): string {
  if (rank === 1) return `${word}, rank 1, exact match, solved`;
  const band = rankToBand(rank);
  return `${word}, rank ${rank}, ${RANK_BAND_TEMPERATURE[band]}`;
}

export function announcementForDuplicate(word: string): string {
  return `${word}, already guessed`;
}

export function announcementForNotInDictionary(word: string): string {
  return `${word}, not in dictionary`;
}
