import { useFeedback } from "@/components/feedback/FeedbackProvider";

/**
 * DEPRECATED COMPATIBILITY LAYER - scheduled for removal.
 *
 * This file used to *implement* the notification system. It no longer does. The
 * single implementation now lives in `components/feedback/FeedbackProvider.tsx`,
 * and everything here is a thin adapter over it, so the ~251 existing
 * `toast("success", "...")` call sites keep working during migration without
 * maintaining a second, competing notification implementation.
 *
 * Migration target:
 *
 *   OLD  toast("success", "Customer saved")
 *   NEW  feedback.success({
 *          title: "Customer saved",
 *          message: "Jane Doe's details were updated.",
 *        })
 *
 * The `pushToast` module-global that used to be assigned from the provider's
 * `useEffect` has been kept only as an explicitly documented bridge, and it is
 * now a queue rather than a live binding: a call made before the provider mounts
 * (or after it unmounts) is held briefly and flushed on mount instead of being
 * silently dropped. Once `@/components/Toast` has no remaining importers this
 * file is deleted along with the global.
 *
 * TODO(remove-after-migration): delete when no page imports from
 * "@/components/Toast".
 */

export type ToastType = "success" | "error" | "warning" | "info";

type LegacyToastFn = (
  type: ToastType,
  message: string,
  title?: string,
  action?: { label: string; onClick: () => void },
) => void;

interface QueuedCall {
  type: ToastType;
  message: string;
  title?: string;
  action?: { label: string; onClick: () => void };
}

let activeSink: LegacyToastFn | null = null;
let queue: QueuedCall[] = [];
const QUEUE_LIMIT = 10;

/** Flush pending calls into a live provider, oldest first. */
function flush() {
  if (!activeSink || queue.length === 0) return;
  const pending = queue;
  queue = [];
  for (const call of pending) activeSink(call.type, call.message, call.title, call.action);
}

/**
 * Legacy entry point. Prefer `useFeedback()` in new code.
 *
 * If no provider is mounted yet the call is queued rather than dropped: the old
 * implementation bound this to a no-op until the provider's effect ran, which
 * silently swallowed feedback fired during the first render.
 */
export function toast(type: ToastType, message: string, title?: string, action?: { label: string; onClick: () => void }): void {
  if (activeSink) {
    activeSink(type, message, title, action);
    return;
  }
  queue.push({ type, message, title, action });
  if (queue.length > QUEUE_LIMIT) queue = queue.slice(-QUEUE_LIMIT);
}

/** Legacy hook. Prefer `useFeedback()` in new code. */
export function useToast() {
  const feedback = useFeedback();

  return {
    toast: (type: ToastType, message: string, title?: string, action?: { label: string; onClick: () => void }) => {
      if (type === "success") feedback.success({ title: title ?? message, message: title ? message : undefined, action });
      else if (type === "error") feedback.error({ title: title ?? message, message: title ? message : undefined, action });
      else if (type === "warning") feedback.warning({ title: title ?? message, message: title ? message : undefined, action });
      else feedback.info({ title: title ?? message, message: title ? message : undefined, action });
    },
  };
}

/**
 * Registered by `FeedbackProvider` so the legacy global can reach the single
 * implementation. Called from the provider; not part of the public API.
 */
export function __bindLegacySink(sink: LegacyToastFn): () => void {
  activeSink = sink;
  flush();
  return () => {
    if (activeSink === sink) activeSink = null;
  };
}