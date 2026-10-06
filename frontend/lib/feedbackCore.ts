/**
 * Pure state-transition helpers for the feedback stack.
 *
 * Kept separate from FeedbackProvider so the replacement, dedupe, sticky and
 * duration rules are unit-testable without a DOM (the repo runs tests from the
 * root with `tsx --test`, no React renderer). The provider feeds these pure
 * functions and is the only place that touches timers and React state.
 *
 * Every transition returns `{ records, scheduled }` so the provider can arm or
 * re-arm a timer *outside* the state updater. Resolving timers inside an updater
 * would be a side effect inside a function React may double-invoke under
 * StrictMode - the exact bug this consolidation fixed in ConfirmDialog.
 */

export type FeedbackTone = "success" | "info" | "warning" | "error" | "progress";

export interface FeedbackAction {
  label: string;
  onClick: () => void;
  dismissOnClick?: boolean;
}

export interface FeedbackInput {
  title: string;
  message?: string;
  variant?: string;
  duration?: number;
  sticky?: boolean;
  action?: FeedbackAction;
  dedupeKey?: string;
  replace?: boolean;
}

export interface FeedbackRecord {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
  variant?: string;
  action?: FeedbackAction;
  dedupeKey: string;
  duration: number;
  sticky: boolean;
  exiting: boolean;
}

export interface Transition {
  records: FeedbackRecord[];
  /** The record whose auto-dismiss timer must be armed or re-armed. */
  scheduled?: FeedbackRecord;
  /** The id the caller should use to update/dismiss this notification. */
  effectiveId: string;
}

/**
 * Trim the stack to fit `maxVisible` *transient* cards. Sticky cards (errors
 * needing an action, unfinished progress) are persistent by definition, so they
 * must never be silently evicted by newer success/info cards - otherwise a
 * fixable failure could vanish from the screen under a burst of activity.
 * A hard ceiling still applies so a runaway caller cannot grow the DOM forever.
 */
const STICKY_HARD_CAP = 8;

function trim(items: FeedbackRecord[], maxVisible: number): FeedbackRecord[] {
  const transients = items.filter((r) => !r.sticky);
  if (transients.length <= maxVisible) return items.slice(-Math.max(maxVisible, STICKY_HARD_CAP));
  const overflowCount = transients.length - maxVisible;
  const overflowIds = new Set(transients.slice(0, overflowCount).map((r) => r.id));
  const kept = items.filter((r) => !overflowIds.has(r.id));
  return kept.slice(-STICKY_HARD_CAP);
}

export const DEFAULT_DURATIONS: Record<FeedbackTone, number> = {
  success: 4000,
  info: 5000,
  warning: 9000,
  error: 0,
  progress: 0,
};

const STICKY_TONES: FeedbackTone[] = ["error", "progress"];

export const EXIT_MS = 240;

export function resolveSticky(tone: FeedbackTone, input: FeedbackInput): boolean {
  if (input.sticky != null) return input.sticky;
  if (input.duration === 0) return true;
  if (STICKY_TONES.includes(tone)) return true;
  return false;
}

export function nextId(seq: number): string {
  return `fb-${seq + 1}`;
}

export function toRecord(id: string, tone: FeedbackTone, input: FeedbackInput): FeedbackRecord {
  return {
    id,
    tone,
    title: input.title,
    message: input.message,
    variant: input.variant,
    action: input.action,
    dedupeKey: input.dedupeKey ?? "",
    duration: input.duration ?? DEFAULT_DURATIONS[tone],
    sticky: resolveSticky(tone, input),
    exiting: false,
  };
}

/**
 * Returns the record list after pushing `input`. Pure: no timers, no id
 * allocation (the caller supplies id and arms the returned `scheduled`).
 *
 * Deduplication rules:
 * - No key, no match -> append (respecting maxVisible).
 * - `dedupeKey` matches an on-screen card -> update it in place, or append a
 *   new one when `replace` is true. replace:true is the explicit opt-in for a
 *   genuine repeat of a real operation.
 * - Errors/progress are sticky by default and only removed by explicit dismiss
 *   or update, so they can never be silently pushed out of the visible window.
 */
export function pushRecord(
  prev: FeedbackRecord[],
  id: string,
  tone: FeedbackTone,
  input: FeedbackInput,
  maxVisible: number,
): Transition {
  const record = toRecord(id, tone, input);

  if (record.dedupeKey) {
    const match = prev.find((t) => t.dedupeKey === record.dedupeKey && !t.exiting);
    if (match) {
      if (input.replace) {
        const records = trim([...prev, record], maxVisible);
        return { records, scheduled: record, effectiveId: record.id };
      }
      const merged: FeedbackRecord = {
        ...match,
        tone,
        title: record.title,
        message: record.message,
        variant: record.variant ?? match.variant,
        action: record.action ?? match.action,
        sticky: record.sticky,
        duration: record.duration,
        exiting: false,
      };
      return {
        records: prev.map((t) => (t.id === match.id ? merged : t)),
        scheduled: merged,
        effectiveId: match.id,
      };
    }
  }

  const records = trim([...prev, record], maxVisible);
  return { records, scheduled: record, effectiveId: record.id };
}

export function updateRecord(
  prev: FeedbackRecord[],
  id: string,
  patch: Partial<FeedbackInput>,
): Transition {
  let scheduled: FeedbackRecord | undefined;
  const records = prev.map((t) => {
    if (t.id !== id) return t;
    const next: FeedbackRecord = {
      ...t,
      title: patch.title ?? t.title,
      message: patch.message ?? t.message,
      variant: patch.variant ?? t.variant,
      action: patch.action ?? t.action,
      duration: patch.duration ?? t.duration,
      sticky:
        patch.sticky ??
        (patch.duration === 0 ? true : patch.duration != null ? false : t.sticky),
      exiting: false,
    };
    scheduled = next;
    return next;
  });
  return { records, scheduled, effectiveId: id };
}

export function markExiting(prev: FeedbackRecord[], id: string): Transition {
  return { records: prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)), scheduled: undefined, effectiveId: id };
}

export function dropById(prev: FeedbackRecord[], id: string): Transition {
  return { records: prev.filter((t) => t.id !== id), scheduled: undefined, effectiveId: id };
}

export function markAllExiting(prev: FeedbackRecord[]): Transition {
  return { records: prev.map((t) => ({ ...t, exiting: true })), scheduled: undefined, effectiveId: "" };
}