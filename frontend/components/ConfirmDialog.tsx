import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

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
  resolve: (value: boolean | string | null) => void;
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

  const open = useCallback((kind: "confirm" | "prompt", options: ConfirmOptions | PromptOptions) => {
    if (kind === "prompt") setValue((options as PromptOptions).defaultValue ?? "");
    return new Promise<boolean | string | null>((resolve) => {
      setState({ kind, options, resolve });
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
    };
  }, []);

  const close = useCallback(
    (result: boolean | string | null) => {
      setState((current) => {
        if (current) current.resolve(result);
        return null;
      });
    },
    [],
  );

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

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && options && (
        <div className="modal-overlay" onClick={() => close(null)}>
          <div
            className="modal modal-sm"
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
