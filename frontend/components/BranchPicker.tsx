import React, { useState } from "react";
import type { BranchOption } from "@/lib/branches";

interface Props {
  branches: BranchOption[];
  /** Pre-selected branch, typically the account's last used one. */
  initialBranchId?: number | null;
  busy?: boolean;
  error?: string;
  submitLabel?: string;
  onSubmit: (branchId: number) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Blocking "which branch are you at?" step shown after a staff password check
 * when the account could work at more than one branch. The chosen branch becomes
 * the session's activeBranchId and scopes the POS.
 */
export default function BranchPicker({
  branches,
  initialBranchId,
  busy,
  error,
  submitLabel = "Continue",
  onSubmit,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<number | null>(initialBranchId ?? null);
  const [localError, setLocalError] = useState("");

  const shown = error || localError;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) {
      setLocalError("Choose the branch you are working at.");
      return;
    }
    setLocalError("");
    void onSubmit(selected);
  }

  return (
    <form className="branch-picker" onSubmit={handleSubmit} aria-labelledby="branch-picker-heading">
      <h2 id="branch-picker-heading">Choose your branch</h2>
      <p className="branch-picker-hint">
        Your account works at more than one branch. Pick the one you are in now — sales and stock
        will be recorded against it.
      </p>

      <fieldset className="branch-picker-list">
        <legend className="sr-only">Available branches</legend>
        {branches.map((b) => {
          const inputId = `branch-option-${b.id}`;
          return (
            <label key={b.id} htmlFor={inputId} className={`branch-option${selected === b.id ? " selected" : ""}`}>
              <input
                id={inputId}
                type="radio"
                name="branch"
                value={b.id}
                checked={selected === b.id}
                onChange={() => {
                  setSelected(b.id);
                  setLocalError("");
                }}
              />
              <span className="branch-option-name">{b.name}</span>
            </label>
          );
        })}
      </fieldset>

      {shown ? (
        <p className="auth-error" role="alert">{shown}</p>
      ) : null}

      <div className="auth-actions">
        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Back
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy || branches.length === 0}>
          {busy ? "Working…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
