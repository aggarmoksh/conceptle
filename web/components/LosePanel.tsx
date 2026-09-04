import type { GuessRecord } from "@/lib/gameReducer";
import { loseMessageForBestRank } from "@/lib/loseMessage";
import { topRankedWords } from "@/lib/rank";
import { buildShareString } from "@/lib/share";
import { ShareButton } from "./ShareButton";

const LEARNING_MOMENT_SIZE = 10;

/** v2 lose state: reveal target, tiered closeness message, top-10 nearest
 *  words as a "see how close you were" learning moment, live share button.
 *  Layout: stacked vertical list, confirmed with the user (reuses the
 *  existing GuessList's vertical convention, no swipe or modal needed). */
export function LosePanel({
  target,
  day,
  guesses,
  bestRank,
  ranks,
}: {
  target: string;
  day: number;
  guesses: GuessRecord[];
  bestRank: number;
  ranks: Record<string, number>;
}) {
  const message = loseMessageForBestRank(bestRank);
  const top10 = topRankedWords(ranks, LEARNING_MOMENT_SIZE);

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-[var(--color-border)] px-6 py-8 text-center">
      <p data-testid="revealed-target" className="text-xl font-semibold text-[var(--color-text)]">
        {target}
      </p>
      <p className="text-[var(--color-text-secondary)]">{message}</p>
      <ShareButton shareText={buildShareString(day, guesses, false)} />
      <div className="w-full text-left">
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">See how close you were</p>
        <ol className="flex flex-col gap-1">
          {top10.map(({ word, rank }) => (
            <li
              key={word}
              className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              <span className="tabular-nums text-[var(--color-text-secondary)]">{rank}</span>
              <span className="text-[var(--color-text)]">{word}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
