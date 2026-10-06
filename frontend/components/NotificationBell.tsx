import React, { useEffect, useRef, useState } from "react";
import { api, hasStaffSession, hasCustomerSession, hasProviderSession } from "@/lib/api";
import Icon from "@/components/icons";

function getMsgEndpoint(): string | null {
  if (hasStaffSession()) return "/api/admin/messages";
  if (hasCustomerSession()) return "/api/messages";
  if (hasProviderSession()) return "/api/provider/messages";
  return null;
}

function countUnread(msgs: any[]): number {
  if (hasStaffSession()) return msgs.filter((m) => m.sender_role !== "admin" && !m.read_at).length;
  if (hasCustomerSession()) return msgs.filter((m) => m.sender_role !== "customer" && !m.read_at).length;
  if (hasProviderSession()) return msgs.filter((m) => m.sender_role !== "provider" && !m.read_at).length;
  return 0;
}

/**
 * Failure semantics: a dropped request must not present as "no notifications".
 * `state` distinguishes the three cases the bell can honestly be in:
 *
 *   "ok"          - we have a real count
 *   "unavailable" - the backend could not be reached (cold start, outage); the
 *                   badge hides, the aria-label says "unavailable" instead of
 *                   claiming zero, and we back off so we are not hammering the
 *                   API while it recovers.
 *   "idle"        - no session yet; nothing to fetch.
 */
type BellState = "ok" | "unavailable" | "idle";

export default function NotificationBell({ onClick }: { onClick: () => void }) {
  const [count, setCount] = useState(0);
  const [state, setState] = useState<BellState>("idle");
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(10000);
  // The endpoint is read on every tick so an in-page sign-in/sign-out flips the
  // bell to the correct role or to idle without a reload.
  const endpointRef = useRef<string | null>(null);

  async function fetchCount(): Promise<void> {
    const ep = getMsgEndpoint();
    endpointRef.current = ep;
    if (!ep) {
      setState("idle");
      setCount(0);
      prevRef.current = 0;
      backoffRef.current = 10000;
      return;
    }
    try {
      const raw = await api<any>(ep);
      const list = Array.isArray(raw) ? raw : raw?.messages || [];
      const unread = countUnread(list);
      setCount(unread);
      setState("ok");
      backoffRef.current = 10000;
      if (unread > prevRef.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      }
      prevRef.current = unread;
    } catch {
      // Distinguish "nothing to show" from "we could not ask". Keep the last
      // known count rather than pretending the inbox is empty.
      setState("unavailable");
      backoffRef.current = Math.min(backoffRef.current * 2, 60000);
    }
  }

  function scheduleNext() {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      if (document.visibilityState !== "visible") return;
      await fetchCount();
      scheduleNext();
    }, backoffRef.current);
  }

  useEffect(() => {
    if (getMsgEndpoint()) {
      fetchCount().then(scheduleNext);
    } else {
      setState("idle");
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label =
    state === "unavailable"
      ? "Notification service unavailable. Check back shortly."
      : `Notifications${count > 0 ? ` (${count} unread)` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`bell-btn${pulse ? " pulse" : ""}${state === "unavailable" ? " bell-unavailable" : ""}`}
      aria-label={label}
      title={label}
      aria-live={state === "unavailable" ? "polite" : undefined}
    >
      <Icon name="bell" size={18} />
      {state === "ok" && count > 0 && <span className="bell-badge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
