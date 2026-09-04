import type { GameState } from "./gameReducer";

export function storageKeyForDay(day: number): string {
  return `conceptle:day:${day}:state`;
}

/** Feature-detects a *working* localStorage (private-browsing modes and some
 *  browser settings expose `window.localStorage` but throw on use). */
export function isStorageAvailable(): boolean {
  try {
    const testKey = "__conceptle_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadGameState(day: number): GameState | null {
  try {
    const raw = window.localStorage.getItem(storageKeyForDay(day));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isGameState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGameState(day: number, state: GameState): void {
  try {
    window.localStorage.setItem(storageKeyForDay(day), JSON.stringify(state));
  } catch {
    // Storage disabled or full: the game continues in-memory for this
    // session. The StorageNotice banner is what tells the player.
  }
}

/**
 * Schema migration: a v1 save has `seedDismissed` and no `version` field; a
 * v2 save has `version: 2` but no `probes`/`probePanelDismissed`; a v3 save
 * (current) has both plus `version: 3`. Checking `version === 3` here is
 * the entire migration: both older shapes fail this check, loadGameState
 * returns null, and the caller starts a fresh v3 game for that day. Same
 * policy each time a schema changes: pre-launch, no real player data is
 * being lost, so silently discarding on any mismatch is correct, not a bug.
 */
function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 3 &&
    Array.isArray(v.guesses) &&
    Array.isArray(v.probes) &&
    typeof v.probePanelDismissed === "boolean" &&
    typeof v.won === "boolean"
  );
}
