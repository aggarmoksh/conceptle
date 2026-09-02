export interface PuzzleData {
  day: number;
  target_hint: string;
  ranks: Record<string, number>;
  vocab_size: number;
}

/**
 * Decode the base64-obfuscated target field. Only ever called after a win
 * (rank 1 guess) per requirement 2 and CLAUDE.md's anti-cheat posture: this
 * is a casual "defeat view-source" measure, not real security, so decoding
 * client-side after win is fine, decoding it before win (e.g. to prefetch)
 * would defeat the point.
 */
export function decodeTargetHint(targetHint: string): string {
  return atob(targetHint);
}

export class PuzzleFetchError extends Error {}

export async function fetchPuzzle(day: number): Promise<PuzzleData> {
  let response: Response;
  try {
    response = await fetch(`/puzzles/day${day}.json`);
  } catch (cause) {
    throw new PuzzleFetchError(`Network error fetching day ${day} puzzle`, { cause });
  }
  if (!response.ok) {
    throw new PuzzleFetchError(`Day ${day} puzzle returned HTTP ${response.status}`);
  }
  try {
    return (await response.json()) as PuzzleData;
  } catch (cause) {
    throw new PuzzleFetchError(`Day ${day} puzzle response was not valid JSON`, { cause });
  }
}
