/** One-time, non-modal notice for requirement 9's "localStorage disabled"
 *  case. Non-modal: it's a dismissible banner, not a blocking dialog, since
 *  the game is fully playable without storage. */
export function StorageNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
    >
      <span>Progress won&rsquo;t save without localStorage.</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notice"
        className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        ×
      </button>
    </div>
  );
}
