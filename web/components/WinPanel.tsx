import { ShareButtonPlaceholder } from "./ShareButtonPlaceholder";

/** Requirement 7: reveal target, "Solved in N guesses", share placeholder.
 *  The guess input disappearing on win is handled by the parent (it simply
 *  stops rendering GuessInput), not by this component. */
export function WinPanel({ target, guessCount }: { target: string; guessCount: number }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-[var(--color-rank-gold)] px-6 py-8 text-center">
      <p data-testid="revealed-target" className="text-xl font-semibold text-[var(--color-rank-gold)]">
        {target}
      </p>
      <p className="text-[var(--color-text)]">
        Solved in {guessCount} {guessCount === 1 ? "guess" : "guesses"}
      </p>
      <ShareButtonPlaceholder />
    </div>
  );
}
