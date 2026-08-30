import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
  removing?: boolean;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, title?: string, action?: ToastOptions["action"]) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let pushToast: (type: ToastType, message: string, title?: string, action?: ToastOptions["action"]) => void = () => {};

export function toast(type: ToastType, message: string, title?: string, action?: ToastOptions["action"]): void {
  pushToast(type, message, title, action);
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string, title?: string, action?: ToastOptions["action"]) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, title, message, action }].slice(-4));
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 4000);
  }, []);

  useEffect(() => {
    pushToast = addToast;
    return () => {
      pushToast = () => {};
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}${t.removing ? " removing" : ""}`}
            role={t.type === "error" || t.type === "warning" ? "alert" : "status"}
          >
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span className="toast-content">
              {t.title && <span className="toast-title">{t.title}</span>}
              <span className="toast-message">{t.message}</span>
            </span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.map((x) => (x.id === t.id ? { ...x, removing: true } : x)))}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
