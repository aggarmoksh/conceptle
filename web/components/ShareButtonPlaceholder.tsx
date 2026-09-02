/** Visible-but-disabled placeholder per requirement 7. The share string itself
 *  is Phase 3 scope; this exists only so the win screen's layout doesn't jump
 *  when Phase 3 adds the real button. */
export function ShareButtonPlaceholder() {
  return (
    <button
      type="button"
      disabled
      title="coming Phase 3"
      aria-label="Share, coming Phase 3"
      className="cursor-not-allowed rounded-md border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-muted)]"
    >
      Share
    </button>
  );
}
