import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EXIT_MS,
  type FeedbackInput,
  type FeedbackRecord,
  type FeedbackTone,
  type Transition,
  dropById,
  markAllExiting,
  markExiting,
  nextId,
  pushRecord,
  updateRecord,
} from "@/lib/feedbackCore";

/**
 * Canonical feedback system for Gears&Glitch.
 *
 * One provider, one API, four tiers. Callers pick the tier by intent, never by
 * convenience:
 *
 *   1. Inline        - field/form validation, handled by the form itself
 *   2. Transient     - this layer (`success`, `info`, `warning`, `error`)
 *   3. Blocking      - ConfirmDialog, for irreversible work
 *   4. Persistent    - NotificationBell, for events needing acknowledgement
 *
 * The state transitions live in frontend/lib/feedbackCore.ts as pure functions.
 * This component is the only place timers and React state are touched, and
 * timers are armed from the *result* of a pure transition - never inside a state
 * updater, so React StrictMode's double-invocation cannot leak timers.
 */

export type { FeedbackInput, FeedbackRecord, FeedbackTone };

export interface FeedbackHandle {
  id: string;
  update: (patch: Partial<Omit<FeedbackInput, "dedupeKey" | "replace">>) => void;
  dismiss: () => void;
}

interface FeedbackContextValue {
  success: (input: FeedbackInput | string, message?: string) => string;
  info: (input: FeedbackInput | string, message?: string) => string;
  warning: (input: FeedbackInput | string, message?: string) => string;
  error: (input: FeedbackInput | string, message?: string) => string;
  progress: (input: FeedbackInput | string, message?: string) => FeedbackHandle;
  update: (id: string, patch: Partial<FeedbackInput>) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}

function normalise(input: FeedbackInput | string, message?: string): FeedbackInput {
  return typeof input === "string" ? { title: input, message } : input;
}

export function FeedbackProvider({
  children,
  maxVisible = 4,
}: {
  children: React.ReactNode;
  maxVisible?: number;
}) {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  // Mirror of `items` used to feed pure transitions. Keeping a ref means a
  // transition can be computed against the current list and its timer armed
  // outside any state updater, which is StrictMode-safe.
  const itemsRef = useRef<FeedbackRecord[]>([]);
  const seqRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const commit = useCallback((transition: Transition) => {
    itemsRef.current = transition.records;
    setItems(transition.records);
    return transition;
  }, []);

  const clearTimer = useCallback((id: string) => {
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  /** Begin the exit animation, then drop the record once it has played out. */
  const beginExit = useCallback(
    (id: string) => {
      clearTimer(id);
      commit(markExiting(itemsRef.current, id));
      const drop = setTimeout(() => {
        timersRef.current.delete(id);
        commit(dropById(itemsRef.current, id));
      }, EXIT_MS);
      timersRef.current.set(id, drop);
    },
    [clearTimer, commit],
  );

  const remove = useCallback(
    (id: string) => {
      clearTimer(id);
      commit(dropById(itemsRef.current, id));
    },
    [clearTimer, commit],
  );

  const schedule = useCallback(
    (record: FeedbackRecord) => {
      clearTimer(record.id);
      if (record.exiting) return;
      if (record.sticky) return;
      const handle = setTimeout(() => {
        timersRef.current.delete(record.id);
        beginExit(record.id);
      }, record.duration);
      timersRef.current.set(record.id, handle);
    },
    [beginExit, clearTimer],
  );

  const push = useCallback(
    (tone: FeedbackTone, input: FeedbackInput): string => {
      const id = nextId(seqRef.current);
      seqRef.current += 1;
      const transition = pushRecord(itemsRef.current, id, tone, input, maxVisible);
      commit(transition);
      if (transition.scheduled) schedule(transition.scheduled);
      return transition.effectiveId;
    },
    [commit, maxVisible, schedule],
  );

  const update = useCallback(
    (id: string, patch: Partial<FeedbackInput>) => {
      const transition = updateRecord(itemsRef.current, id, patch);
      commit(transition);
      if (transition.scheduled) schedule(transition.scheduled);
    },
    [commit, schedule],
  );

  const handleFor = useCallback(
    (id: string): FeedbackHandle => ({
      id,
      update: (patch) => update(id, patch),
      dismiss: () => remove(id),
    }),
    [remove, update],
  );

  const dismiss = useCallback(beginExit, [beginExit]);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((handle) => clearTimeout(handle));
    timersRef.current.clear();
    commit(markAllExiting(itemsRef.current));
  }, [commit]);

  // Drop every pending timer on unmount so a navigating-away tree cannot leave a
  // callback holding state React will warn about.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((handle) => clearTimeout(handle));
      timers.clear();
    };
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      success: (input, message) => push("success", normalise(input, message)),
      info: (input, message) => push("info", normalise(input, message)),
      warning: (input, message) => push("warning", normalise(input, message)),
      error: (input, message) => push("error", normalise(input, message)),
      progress: (input, message) => handleFor(push("progress", normalise(input, message))),
      update,
      dismiss,
      dismissAll,
    }),
    [push, handleFor, update, dismiss, dismissAll],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackViewport items={items} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  );
}

/**
 * Live-region strategy.
 *
 * Each notification is announced exactly once. The card is not itself a live
 * region; instead the stack is split by tone:
 *
 * - errors/warnings render inside `role="alert"` (assertive, interrupting)
 * - success/info/progress render inside `role="status" aria-live="polite"`
 *
 * This replaces the old arrangement where the *container* carried
 * `aria-live="polite"` while error cards also carried `role="alert"`, so an
 * error was announced twice. Splitting by tone also means a success never
 * interrupts an error the user still needs to read.
 */
function FeedbackViewport({
  items,
  onDismiss,
}: {
  items: FeedbackRecord[];
  onDismiss: (id: string) => void;
}) {
  const assertive = items.filter((t) => t.tone === "error" || t.tone === "warning");
  const polite = items.filter((t) => t.tone !== "error" && t.tone !== "warning");

  return (
    <div className="feedback-root">
      <div className="feedback-region feedback-region-assertive">
        {assertive.map((item) => (
          <FeedbackCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </div>
      <div className="feedback-region feedback-region-polite" role="status" aria-live="polite" aria-atomic="false">
        {polite.map((item) => (
          <FeedbackCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

const TONE_GLYPH: Record<FeedbackTone, string> = {
  success: "\u2713",
  error: "\u2715",
  warning: "\u26A0",
  info: "\u2139",
  progress: "",
};

function FeedbackCard({ item, onDismiss }: { item: FeedbackRecord; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`feedback-card feedback-${item.tone}${item.exiting ? " is-exiting" : ""}${item.variant ? ` feedback-variant-${item.variant}` : ""}`}
      data-feedback-id={item.id}
    >
      <span className="feedback-rail" aria-hidden="true" />
      <span className={`feedback-icon feedback-icon-${item.tone}`} aria-hidden="true">
        {item.tone === "progress" ? <span className="feedback-spinner" /> : TONE_GLYPH[item.tone]}
      </span>
      <div className="feedback-body">
        <p className="feedback-title">{item.title}</p>
        {item.message && <p className="feedback-message">{item.message}</p>}
        {item.action && (
          <button
            type="button"
            className="feedback-action"
            onClick={() => {
              item.action?.onClick();
              if (item.action?.dismissOnClick !== false) onDismiss(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="feedback-close"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss notification: ${item.title}`}
      >
        <span aria-hidden="true">\u00D7</span>
      </button>
    </div>
  );
}