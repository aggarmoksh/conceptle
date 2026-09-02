import { RANK_BAND_COLORS, rankToBand } from "@/lib/rank";
import type { GuessRecord } from "@/lib/gameReducer";

/** Newest-on-top per requirement 4. Data model stores guesses chronologically
 *  (oldest first, see gameReducer.ts) so this is the only place order is
 *  reversed, keeping the state/display distinction clean. */
export function GuessList({ guesses }: { guesses: GuessRecord[] }) {
  const newestFirst = [...guesses].reverse();

  return (
    <ol className="flex flex-col gap-1.5" aria-label="Your guesses, newest first">
      {newestFirst.map((g) => {
        const band = rankToBand(g.rank);
        const colors = RANK_BAND_COLORS[band];
        return (
          <li
            key={g.word}
            className="flex items-center justify-between rounded-md px-4 py-2 font-medium"
            style={{ background: colors.fill, color: colors.text }}
          >
            {/* Rank number is always shown alongside the color per requirement
                4 ("No color-only signal") so band membership never depends on
                perceiving the fill color correctly. */}
            <span className="tabular-nums">{g.rank}</span>
            <span>{g.word}</span>
          </li>
        );
      })}
    </ol>
  );
}
