import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useFocusTrap } from "@/components/ui/focusTrap";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type PromptFn = (options: PromptOptions) => Promise<string | null>;

interface DialogState {
  kind: "confirm" | "prompt";
  options: ConfirmOptions | PromptOptions;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

let pendingConfirm: ConfirmFn = async () => false;
let pendingPrompt: PromptFn = async () => null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return pendingConfirm(options);
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return pendingPrompt(options);
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used within ConfirmProvider");
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  const confirmRef = useRef<ConfirmFn>(() => Promise.resolve(false));
  const promptRef = useRef<PromptFn>(() => Promise.resolve(null));
  // The resolver lives in a ref, never in state. React is free to call a state
  // updater more than once (StrictMode double-invokes updaters in development to
  // surface impurity), so resolving from inside setState would be a side effect in
  // a function React may run twice. Keeping it out of state makes the transition
  // pure and guarantees the awaiting caller is settled exactly once.
  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null);

  const open = useCallback((kind: "confirm" | "prompt", options: ConfirmOptions | PromptOptions) => {
    if (kind === "prompt") setValue((options as PromptOptions).defaultValue ?? "");
    return new Promise<boolean | string | null>((resolve) => {
      // Opening a second dialog while one is pending abandons the first promise.
      // Settle it as "declined" so the first caller is never left awaiting
      // forever (which would hang its loading state).
      if (resolverRef.current) resolverRef.current(null);
      resolverRef.current = resolve;
      setState({ kind, options });
    });
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => open("confirm", options) as Promise<boolean>, [open]);
  const prompt = useCallback<PromptFn>((options) => open("prompt", options) as Promise<string | null>, [open]);

  confirmRef.current = confirm;
  promptRef.current = prompt;

  useEffect(() => {
    pendingConfirm = confirmRef.current;
    pendingPrompt = promptRef.current;
    return () => {
      pendingConfirm = async () => false;
      pendingPrompt = async () => null;
      // Unmounting with a dialog open must not strand the caller either.
      if (resolverRef.current) resolverRef.current(null);
      resolverRef.current = null;
    };
  }, []);

  const close = useCallback((result: boolean | string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    // Called outside the state updater so it happens exactly once.
    if (resolve) resolve(result);
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, close]);

  const isPrompt = state?.kind === "prompt";
  const options = state?.options as ConfirmOptions | PromptOptions | undefined;
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !!state, { focusFirst: false });

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && options && (
        <div className="modal-overlay" onClick={() => close(null)}>
          <div
            className="modal modal-sm"
            ref={dialogRef}
            role={isPrompt ? "dialog" : "alertdialog"}
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" id="confirm-dialog-title">
                {options.title ?? "Are you sure?"}
              </h3>
              <button className="modal-close" onClick={() => close(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              {options.message && (
                <p className="muted" style={{ margin: isPrompt ? "0 0 var(--space-3)" : 0 }}>
                  {options.message}
                </p>
              )}
              {isPrompt && (
                <label style={{ display: "block" }}>
                  {(options as PromptOptions).label && (
                    <span className="field-label" style={{ display: "block", marginBottom: "0.35rem" }}>
                      {(options as PromptOptions).label}
                    </span>
                  )}
                  <input
                    className="input"
                    type="text"
                    value={value}
                    autoFocus
                    placeholder={(options as PromptOptions).placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") close(value.trim());
                    }}
                  />
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => close(null)}>
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                className={options.danger ? "btn btn-danger" : "btn btn-primary"}
                autoFocus={!isPrompt}
                onClick={() => close(isPrompt ? value.trim() : true)}
              >
                {options.confirmLabel ?? (isPrompt ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
