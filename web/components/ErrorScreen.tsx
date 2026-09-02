/** Full-page fetch-failure state (requirement 9): the game cannot render at
 *  all without today's puzzle JSON, so this replaces the whole page rather
 *  than degrading a partial UI. */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <p className="text-[var(--color-text)]">Could not load today&rsquo;s puzzle.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-[var(--color-border)] px-4 py-2 text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        Retry
      </button>
    </div>
  );
}
