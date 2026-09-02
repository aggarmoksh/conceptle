/**
 * Guess normalization: trim, lowercase, strip anything that isn't a-z.
 * Applied to every raw guess (typed or from a seed-word button) before
 * lookup, so "Kitchen!", " kitchen ", and "kitchen" all resolve identically.
 */
export function normalizeGuess(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}
