/**
 * Phase 2.5: shared-attribute phrase per guess (Phase 1.6 task B's
 * pipeline/data/attributes/dayN.json, shipped to
 * web/public/attributes/dayN.json). Keyed by vocabulary lemma, scoped to a
 * single day (unlike categories.json, which is shared across all days):
 * each day's file only has entries for that day's target's top-200 nearest
 * neighbors, and a missing entry means "no attribute signal for this
 * guess," not an error.
 */
export type AttributeMap = Record<string, string>;

interface AttributesFile {
  day: number;
  attributes: AttributeMap;
}

/**
 * Fetches today's attribute file. Failure (network error, day not
 * generated, malformed JSON) degrades gracefully to an empty map: the
 * attribute phrase is a feedback enhancement, not a hard dependency like
 * the puzzle JSON itself, so its absence should never block play.
 */
export async function fetchAttributes(day: number): Promise<AttributeMap> {
  try {
    const response = await fetch(`/attributes/day${day}.json`);
    if (!response.ok) return {};
    const parsed = (await response.json()) as AttributesFile;
    return parsed.attributes ?? {};
  } catch {
    return {};
  }
}

export function lookupAttribute(word: string, attributes: AttributeMap): string | undefined {
  return attributes[word];
}
