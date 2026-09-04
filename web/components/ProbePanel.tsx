"use client";

import { PROBE_WORDS, type ProbeWord } from "@/lib/gameReducer";

interface ProbePanelProps {
  usedProbes: ReadonlySet<ProbeWord>;
  onProbeClick: (word: ProbeWord) => void;
  onDismiss: () => void;
}

/** Phase 2.5.1 Fix B: budget-free probe words. Style matches the original
 *  v1 seed panel (subtle text buttons, confirmed with the user in Phase 2):
 *  a quiet hint rather than a competing UI element. A used probe's button
 *  is removed from the row entirely (its result is already visible in the
 *  guess list below) rather than shown disabled, so there is nothing to
 *  click twice. */
export function ProbePanel({ usedProbes, onProbeClick, onDismiss }: ProbePanelProps) {
  const available = PROBE_WORDS.filter((word) => !usedProbes.has(word));

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[var(--color-text-secondary)]">Not sure where to start?</span>
        {available.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onProbeClick(word)}
            className="text-[var(--color-text)] underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-text)]"
          >
            {word}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestions"
        className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        ×
      </button>
    </div>
  );
}
