"use client";

import { useState } from "react";

/** Live share button (Phase 2.5): copies the pre-built share string and
 *  shows a brief confirmation. Confirmation is a local `role="status"` text
 *  node rather than routed through the page's shared ARIA live region, so
 *  this component is fully self-contained and reusable from both WinPanel
 *  and LosePanel without a callback prop. */
export function ShareButton({ shareText }: { shareText: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(shareText);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border border-[var(--color-border)] px-4 py-2 text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        Share
      </button>
      <p role="status" className="h-4 text-xs text-[var(--color-text-secondary)]">
        {status === "copied" && "Copied to clipboard"}
        {status === "error" && "Could not copy"}
      </p>
    </div>
  );
}
