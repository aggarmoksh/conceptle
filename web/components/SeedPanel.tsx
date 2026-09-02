"use client";

// Requirement 6: literal words, submitted verbatim as a guess when clicked.
const SEED_WORDS = ["animal", "action", "place", "emotion", "material"] as const;

interface SeedPanelProps {
  onSeedClick: (word: string) => void;
  onDismiss: () => void;
}

// Style: subtle text buttons, confirmed with the user over filled pills, to
// read as a quiet hint rather than a competing UI element.
export function SeedPanel({ onSeedClick, onDismiss }: SeedPanelProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[var(--color-text-secondary)]">Try one of these to start</span>
        {SEED_WORDS.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onSeedClick(word)}
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
