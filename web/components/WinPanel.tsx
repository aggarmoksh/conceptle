import { MAX_GUESSES, type GuessRecord } from "@/lib/gameReducer";
import { buildShareString } from "@/lib/share";
import { ShareButton } from "./ShareButton";

/** v2 win state: reveal target, "Solved in N/6", live share button. The
 *  guess input disappearing on win is handled by the parent (it simply
 *  stops rendering GuessInput), not by this component. */
export function WinPanel({
  target,
  day,
  guesses,
}: {
  target: string;
  day: number;
  guesses: GuessRecord[];
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-[var(--color-rank-gold)] px-6 py-8 text-center">
      <p data-testid="revealed-target" className="text-xl font-semibold text-[var(--color-rank-gold)]">
        {target}
      </p>
      <p className="text-[var(--color-text)]">
        Solved in {guesses.length}/{MAX_GUESSES}
      </p>
      <ShareButton shareText={buildShareString(day, guesses, true)} />
    </div>
  );
}
