import React, { useState } from "react";
import { getActiveBranchId, getBranchOptions, switchBranch, type BranchOption } from "@/lib/branches";

interface Props {
  branches?: BranchOption[];
  onSwitched?: (branchId: number) => void | Promise<void>;
  compact?: boolean;
}

/**
 * Mid-session branch switcher. Calls /api/auth/switch-branch, which re-issues the
 * session cookie with the new activeBranchId, then lets the caller re-bootstrap
 * its session so the rest of the app sees the new claim.
 *
 * Renders nothing when the account has fewer than two branches — there is no
 * choice to make.
 */
export default function BranchSwitcher({ branches, onSwitched, compact }: Props) {
  const options = branches && branches.length > 0 ? branches : getBranchOptions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (options.length < 2) return null;

  const activeId = getActiveBranchId();
  const active = options.find((b) => b.id === activeId) ?? null;

  async function choose(branchId: number) {
    setBusy(true);
    setError("");
    try {
      await switchBranch(branchId);
      setOpen(false);
      if (onSwitched) await onSwitched(branchId);
    } catch (err: any) {
      setError(err?.message || "Could not switch branch.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`branch-switcher-trigger${compact ? " compact" : ""}`}
        onClick={() => setOpen(true)}
        disabled={busy}
        aria-label={active ? `Current branch: ${active.name}. Change branch` : "Choose branch"}
      >
        <span className="branch-switcher-label">Branch</span>
        <span className="branch-switcher-value">{active ? active.name : "Not set"}</span>
      </button>
    );
  }

  return (
    <div className="branch-switcher" role="group" aria-label="Switch branch">
      <span className="branch-switcher-label">Branch</span>
      <div className="branch-switcher-options">
        {options.map((b) => {
          const isActive = b.id === activeId;
          return (
            <button
              key={b.id}
              type="button"
              className={`branch-switcher-option${isActive ? " active" : ""}`}
              onClick={() => choose(b.id)}
              disabled={busy}
              aria-current={isActive ? "true" : undefined}
            >
              {b.name}
            </button>
          );
        })}
      </div>
      <button type="button" className="branch-switcher-cancel" onClick={() => { setOpen(false); setError(""); }} disabled={busy}>
        Cancel
      </button>
      {error ? <p className="branch-switcher-error" role="alert">{error}</p> : null}
    </div>
  );
}
