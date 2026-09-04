/**
 * Phase 2.5: category tag per guess (Phase 1.6 task A's pipeline/data/
 * categories.json, shipped to web/public/categories.json). Keyed by
 * vocabulary lemma, same convention as forms.json's targets and
 * attributes/dayN.json's candidates.
 */
export type CategoryMap = Record<string, string>;

/**
 * Category is only shown for a close-enough guess. Raised from 500 to 2500
 * in Phase 2.5.1: playtest showed that on hard targets most early guesses
 * land between 900 and 4000, so the original 500-rank gate meant players
 * got no directional signal at all until they had already found the
 * neighborhood by luck. 2500 still withholds tags from hopeless guesses
 * while telling a player which hemisphere they are in. A named constant
 * rather than a magic number so the threshold has one place to change.
 *
 * Attribute phrases are NOT gated by any rank threshold (see lib/
 * attributes.ts's lookupAttribute): they show whenever an attribute exists
 * for that (target, guess) pair, unchanged by this fix.
 */
export const CATEGORY_VISIBILITY_RANK_THRESHOLD = 2500;

export function shouldShowCategory(rank: number): boolean {
  return rank <= CATEGORY_VISIBILITY_RANK_THRESHOLD;
}

/**
 * Fetches categories.json once per session (not per day: it's the same file
 * for every puzzle). Failure degrades gracefully to an empty map, same
 * pattern as fetchForms/fetchAttributes: this is a feedback enhancement, not
 * a hard dependency like the puzzle JSON itself.
 */
export async function fetchCategories(): Promise<CategoryMap> {
  try {
    const response = await fetch("/categories.json");
    if (!response.ok) return {};
    return (await response.json()) as CategoryMap;
  } catch {
    return {};
  }
}

export function lookupCategory(word: string, categories: CategoryMap): string | undefined {
  return categories[word];
}
