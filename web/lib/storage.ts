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

function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.guesses) &&
    typeof v.won === "boolean" &&
    typeof v.seedDismissed === "boolean"
  );
}
