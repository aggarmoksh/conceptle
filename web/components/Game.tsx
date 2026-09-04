"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDayOverride, resolveDayNumber } from "@/lib/day";
import { normalizeGuess } from "@/lib/guess";
import {
  bestRank,
  guessesRemaining,
  initialGameState,
  isLost,
  submitGuess,
  type DayData,
  type GameState,
  type SubmitResult,
} from "@/lib/gameReducer";
import { fetchForms, type FormMap } from "@/lib/forms";
import { fetchCategories, type CategoryMap } from "@/lib/categories";
import { fetchAttributes, type AttributeMap } from "@/lib/attributes";
import { decodeTargetHint, fetchPuzzle, type PuzzleData } from "@/lib/puzzle";
import { loseMessageForBestRank } from "@/lib/loseMessage";
import { isStorageAvailable, loadGameState, saveGameState } from "@/lib/storage";
import {
  announcementForAdded,
  announcementForDuplicate,
  announcementForLost,
  announcementForNotInDictionary,
} from "@/lib/announce";
import { GuessInput } from "./GuessInput";
import { GuessesRemaining } from "./GuessesRemaining";
import { GuessList } from "./GuessList";
import { Thermometer } from "./Thermometer";
import { WinPanel } from "./WinPanel";
import { LosePanel } from "./LosePanel";
import { ErrorScreen } from "./ErrorScreen";
import { StorageNotice } from "./StorageNotice";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; puzzle: PuzzleData; day: DayData };

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
    // categories.json, forms.json, and today's attribute file are all
    // correctness/feedback enhancements, not hard dependencies like the
    // puzzle itself: each of their fetchers degrades to {} on failure, so a
    // failure in any of them can't turn into a spurious full-page error here.
    Promise.all([fetchPuzzle(day), fetchForms(), fetchCategories(), fetchAttributes(day)])
      .then(([puzzle, forms, categories, attributes]) => {
        setLoad({ status: "ready", puzzle, day: { ranks: puzzle.ranks, forms, categories, attributes } });
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
    const result = submitGuess(game, raw, load.day);
    setGame(result.state);

    const normalized = normalizeGuess(raw);
    if (result.kind === "added") {
      const last = result.state.guesses.at(-1)!;
      if (isLost(result.state)) {
        setAnnouncement(announcementForLost(loseMessageForBestRank(bestRank(result.state)!)));
      } else {
        setAnnouncement(announcementForAdded(last.word, last.rank, last.category, last.attribute));
      }
    } else if (result.kind === "duplicate") {
      setAnnouncement(announcementForDuplicate(normalized));
    } else if (result.kind === "not-in-dictionary") {
      setAnnouncement(announcementForNotInDictionary(normalized));
    }
    return result.kind;
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

  const best = bestRank(game);
  const lost = isLost(game);
  const target = game.won || lost ? decodeTargetHint(load.puzzle.target_hint) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
        <h1 className="text-lg font-semibold">Conceptle</h1>
        <span className="text-sm text-[var(--color-text-secondary)]">Day {day}</span>
      </header>

      {showStorageNotice && <StorageNotice onDismiss={() => setShowStorageNotice(false)} />}

      <Thermometer best={best} />

      {game.won && target !== null && <WinPanel target={target} day={day} guesses={game.guesses} />}

      {lost && target !== null && (
        <LosePanel
          target={target}
          day={day}
          guesses={game.guesses}
          bestRank={best!}
          ranks={load.puzzle.ranks}
        />
      )}

      {!game.won && !lost && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <GuessInput onSubmit={handleSubmit} />
          </div>
          <GuessesRemaining remaining={guessesRemaining(game)} />
        </div>
      )}

      <GuessList guesses={game.guesses} />

      {/* Requirement 10: ARIA live region announcing each guess result. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </main>
  );
}
