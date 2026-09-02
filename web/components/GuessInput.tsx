"use client";

import { useEffect, useRef, useState } from "react";
import type { SubmitResult } from "@/lib/gameReducer";

interface GuessInputProps {
  onSubmit: (raw: string) => SubmitResult["kind"];
}

/** Single guess input: autofocus, Enter submits (native form submit), inline
 *  error under the input for duplicate/not-in-dictionary. The input is never
 *  cleared on those two outcomes (requirement 3) so the player can see and
 *  fix what they typed; it is cleared only after a successful add. */
export function GuessInput({ onSubmit }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kind = onSubmit(value);
    if (kind === "added") {
      setValue("");
      setError(null);
    } else if (kind === "duplicate") {
      setError("already guessed");
    } else if (kind === "not-in-dictionary") {
      setError("not in dictionary");
    }
    // "empty": nothing meaningful was typed; leave the field as-is, no error.
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        aria-label="Enter a guess"
        aria-invalid={error !== null}
        aria-describedby={error ? "guess-error" : undefined}
        placeholder="type a guess"
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-secondary)]"
      />
      {error && (
        <p id="guess-error" className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}
    </form>
  );
}
