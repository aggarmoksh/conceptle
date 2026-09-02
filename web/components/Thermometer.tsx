"use client";

import { rankToThermometerPosition } from "@/lib/rank";

/**
 * Persistent "best rank this session" meter. Placement (inline, above the
 * guess input) and the palette (dark theme rank-band hues) were both design
 * decisions confirmed with the user before implementation.
 *
 * Orientation: horizontal, not vertical. Argued briefly per the kickoff's
 * ask: a horizontal bar reads left-to-right the same direction as the guess
 * list and input above/below it, needs no extra vertical space in a
 * single-column mobile layout (a vertical bar would compete with the guess
 * list for the viewport's scarcest dimension on phones), and a left-to-right
 * gradient is the more familiar "progress bar" convention than a bottom-to-top
 * one for a first-time player.
 */
export function Thermometer({ best }: { best: number | undefined }) {
  const position = best !== undefined ? rankToThermometerPosition(best) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={
          best !== undefined
            ? `Best rank achieved this session: ${best}`
            : "Best rank achieved this session: none yet"
        }
        className="relative h-3 flex-1 rounded-full"
        style={{
          background:
            "linear-gradient(to right, var(--color-rank-red) 0%, var(--color-rank-yellow) 21%, var(--color-rank-green) 38%, var(--color-rank-bright-green) 58%, var(--color-rank-gold) 100%)",
        }}
      >
        {best !== undefined && (
          <div
            aria-hidden="true"
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 transition-[left] duration-300"
            style={{
              left: `${position * 100}%`,
              background: "var(--color-text)",
              borderColor: "var(--color-bg)",
            }}
          />
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-[var(--color-text-secondary)]">
        {best !== undefined ? `best ${best}` : "best —"}
      </span>
    </div>
  );
}
