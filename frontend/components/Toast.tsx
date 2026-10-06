/**
 * DEPRECATED - re-export of the feedback compatibility layer.
 *
 * This module used to contain the entire notification implementation (its own
 * provider, its own container, its own CSS). All of that now lives in
 * `components/feedback/`. This file exists only so the ~251 existing
 * `import { toast, useToast } from "@/components/Toast"` call sites keep
 * resolving while they are migrated to `useFeedback()`.
 *
 * Delete this file once no page imports it. See feedback/legacyToast.ts for the
 * migration note and the reasoning behind the remaining global.
 */
export { toast, useToast } from "@/components/feedback/legacyToast";
export type { ToastType } from "@/components/feedback/legacyToast";