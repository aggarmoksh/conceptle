"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDayOverride, resolveDayNumber } from "@/lib/day";
import { normalizeGuess } from "@/lib/guess";
import {
  bestRank,
  dismissSeedPanel,
  initialGameState,
  submitGuess,
  type GameState,
  type SubmitResult,
} from "@/lib/gameReducer";
import { decodeTargetHint, fetchPuzzle, type PuzzleData } from "@/lib/puzzle";
import { isStorageAvailable, loadGameState, saveGameState } from "@/lib/storage";
import {
  announcementForAdded,
  announcementForDuplicate,
  announcementForNotInDictionary,
} from "@/lib/announce";
import { GuessInput } from "./GuessInput";
import { GuessList } from "./GuessList";
import { Thermometer } from "./Thermometer";
import { SeedPanel } from "./SeedPanel";
import { WinPanel } from "./WinPanel";
import { ErrorScreen } from "./ErrorScreen";
import { StorageNotice } from "./StorageNotice";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; puzzle: PuzzleData };

export function Game() {
  // Resolved once per mount; a puzzle day never changes under a live tab, and
  // recomputing on every render would risk it drifting across a UTC midnight
  // mid-session, which the reducer/localStorage below aren't built to handle.
  // `?day=N` is a dev/testing convenience (see lib/day.ts), not a shipped
  // feature; window is guarded since this render also runs during SSR.
  const day = useMemo(() => {
    const override = typeof window !== "undefined" ? parseDayOverride(window.location.search) : null;
    return override ?? resolveDayNumber(new Date());
  }, []);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [game, setGame] = useState<GameState>(initialGameState());
  const [announcement, setAnnouncement] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showStorageNotice, setShowStorageNotice] = useState(false);

  const loadPuzzle = useCallback(() => {
    setLoad({ status: "loading" });
    fetchPuzzle(day)
      .then((puzzle) => {
        setLoad({ status: "ready", puzzle });
        const available = isStorageAvailable();
        setStorageAvailable(available);
        setShowStorageNotice(!available);
        if (available) {
          const stored = loadGameState(day);
          if (stored) setGame(stored);
        }
      })
      .catch(() => setLoad({ status: "error" }));
  }, [day]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  // Persist on every state change once the puzzle is loaded, so a reload
  // mid-game restores exactly (requirement 8).
  useEffect(() => {
    if (load.status === "ready" && storageAvailable) {
      saveGameState(day, game);
    }
  }, [game, day, load.status, storageAvailable]);

  function handleSubmit(raw: string): SubmitResult["kind"] {
    if (load.status !== "ready") return "empty";
    const result = submitGuess(game, raw, load.puzzle.ranks);
    setGame(result.state);

    const normalized = normalizeGuess(raw);
    if (result.kind === "added") {
      const last = result.state.guesses.at(-1)!;
      setAnnouncement(announcementForAdded(last.word, last.rank));
    } else if (result.kind === "duplicate") {
      setAnnouncement(announcementForDuplicate(normalized));
    } else if (result.kind === "not-in-dictionary") {
      setAnnouncement(announcementForNotInDictionary(normalized));
    }
    return result.kind;
  }

  function handleDismissSeedPanel() {
    setGame((prev) => dismissSeedPanel(prev));
  }

  if (load.status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-[var(--color-text-secondary)]">Loading todays puzzle…</p>
      </main>
    );
  }

  if (load.status === "error") {
    return <ErrorScreen onRetry={loadPuzzle} />;
  }

  const showSeedPanel = !game.seedDismissed && game.guesses.length === 0;
  const best = bestRank(game);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
        <h1 className="text-lg font-semibold">Conceptle</h1>
        <span className="text-sm text-[var(--color-text-secondary)]">Day {day}</span>
      </header>

      {showStorageNotice && <StorageNotice onDismiss={() => setShowStorageNotice(false)} />}

      {showSeedPanel && (
        <SeedPanel onSeedClick={(word) => handleSubmit(word)} onDismiss={handleDismissSeedPanel} />
      )}

      <Thermometer best={best} />

      {game.won ? (
        <WinPanel
          target={decodeTargetHint(load.puzzle.target_hint)}
          guessCount={game.guesses.length}
        />
      ) : (
        <GuessInput onSubmit={handleSubmit} />
      )}

      <GuessList guesses={game.guesses} />

      {/* Requirement 10: ARIA live region announcing each guess result. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </main>
  );
}
