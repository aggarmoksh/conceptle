import { RANK_BAND_COLORS, rankToBand } from "@/lib/rank";
import type { GuessRecord } from "@/lib/gameReducer";

interface GuessListProps {
  guesses: GuessRecord[];
  probes: GuessRecord[];
}

/**
 * Newest-on-top per requirement 4, now covering both pools. Guesses are
 * always chronologically newer than probes (the probe panel's own
 * visibility rule hides it once a real guess exists), so rendering
 * reversed-guesses then reversed-probes is already correct newest-first
 * order with no extra bookkeeping.
 *
 * Probe row style (Phase 2.5.1 Fix B, confirmed with the user): outlined,
 * no fill, versus a real guess's solid rank-band background. The band
 * color drives the BORDER only, not the text: the "green" band hex
 * (#3f8f3f) measures 4.48:1 as text against the dark page background,
 * just under WCAG AA's 4.5:1 for normal text, while a border only needs
 * 3:1 (a non-text UI component) and every band clears that comfortably.
 * Text inside a probe row stays the app's normal high-contrast color
 * instead of the band hue, sidestepping that near-miss entirely rather
 * than carrying a borderline-legal color choice for one band.
 */
export function GuessList({ guesses, probes }: GuessListProps) {
  const newestFirst = [...guesses].reverse();
  const probesNewestFirst = [...probes].reverse();

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
      {probesNewestFirst.map((p) => {
        const band = rankToBand(p.rank);
        const colors = RANK_BAND_COLORS[band];
        return (
          <li
            key={`probe-${p.word}`}
            className="flex flex-col gap-0.5 rounded-md border-2 px-4 py-2 font-medium text-[var(--color-text)]"
            style={{ borderColor: colors.fill }}
          >
            <div className="flex items-center justify-between">
              <span className="tabular-nums">{p.rank}</span>
              <span className="flex items-center gap-2">
                {p.word}
                {/* "probe" label: the text-based distinction from a real guess,
                    so the outline isn't the only signal (same "no color/shape-
                    only signal" principle as the rank-band color rule). */}
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-normal text-[var(--color-text-secondary)]">
                  probe
                </span>
                {p.category && (
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-normal">
                    {p.category}
                  </span>
                )}
              </span>
            </div>
            {p.attribute && <p className="pl-1 text-xs font-normal opacity-70">{p.attribute}</p>}
          </li>
        );
      })}
    </ol>
  );
}
