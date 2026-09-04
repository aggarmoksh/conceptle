/**
 * Phase 2.5: category tag per guess (Phase 1.6 task A's pipeline/data/
 * categories.json, shipped to web/public/categories.json). Keyed by
 * vocabulary lemma, same convention as forms.json's targets and
 * attributes/dayN.json's candidates.
 */
export type CategoryMap = Record<string, string>;

/** Category is only shown for a close-enough guess, per the v2 spec:
 *  "Category tag ... shown ONLY if rank <= 500". A named constant rather
 *  than a magic number so the threshold has one place to change. */
export const CATEGORY_VISIBILITY_RANK_THRESHOLD = 500;

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
