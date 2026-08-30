import React, { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside `ref` while `active`, optionally focuses the first
 * focusable element on open, and restores focus to the previously focused
 * element on close.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: React.RefObject<T>,
  active: boolean,
  { focusFirst = true }: { focusFirst?: boolean } = {},
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const node = ref.current;

    function focusInitial() {
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) focusables[0].focus();
      else node.focus?.();
    }

    const timer = focusFirst ? setTimeout(focusInitial, 0) : null;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (restoreRef.current && typeof restoreRef.current.focus === "function") {
        restoreRef.current.focus();
      }
    };
  }, [active, ref, focusFirst]);
}
