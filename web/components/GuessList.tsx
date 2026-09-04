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
            className="flex flex-col gap-0.5 rounded-md px-4 py-2 font-medium"
            style={{ background: colors.fill, color: colors.text }}
          >
            <div className="flex items-center justify-between">
              {/* Rank number is always shown alongside the color per requirement
                  4 ("No color-only signal") so band membership never depends on
                  perceiving the fill color correctly. */}
              <span className="tabular-nums">{g.rank}</span>
              <span className="flex items-center gap-2">
                {g.word}
                {/* Category style: subtle chip, confirmed with the user. A
                    semi-transparent dark overlay (not a rank-band color) so it
                    reads as "this is a category label" without ever being
                    mistaken for rank feedback, and stays legible against every
                    band's light background without five separate chip colors. */}
                {g.category && (
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-normal">
                    {g.category}
                  </span>
                )}
              </span>
            </div>
            {/* Attribute placement: separate indented row below, smaller and
                subtler, confirmed with the user. Still plain visible text (not
                aria-hidden) so a screen reader navigating the list directly
                reads it like any other row content. */}
            {g.attribute && <p className="pl-1 text-xs font-normal opacity-70">{g.attribute}</p>}
          </li>
        );
      })}
    </ol>
  );
}
