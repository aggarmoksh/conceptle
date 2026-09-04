import { MAX_GUESSES } from "@/lib/gameReducer";

/** "X/6" next to the input, no verbose label per the v2 copy rules. */
export function GuessesRemaining({ remaining }: { remaining: number }) {
  return (
    <span
      className="shrink-0 text-sm tabular-nums text-[var(--color-text-secondary)]"
      aria-label={`${remaining} of ${MAX_GUESSES} guesses remaining`}
    >
      {remaining}/{MAX_GUESSES}
    </span>
  );
}
