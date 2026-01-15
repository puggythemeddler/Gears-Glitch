import React, { useEffect, useRef, useState } from "react";
import { api, getCustomerToken, getProviderToken, getStaffToken } from "@/lib/api";

function getMsgEndpoint(): string | null {
  if (getStaffToken()) return "/api/admin/messages";
  if (getCustomerToken()) return "/api/messages";
  if (getProviderToken()) return "/api/provider/messages";
  return null;
}

function countUnread(msgs: any[]): number {
  if (getStaffToken()) return msgs.filter((m) => !m.read_at).length;
  if (getCustomerToken()) return msgs.filter((m) => m.sender_role === "provider" && !m.read_at).length;
  if (getProviderToken()) return msgs.filter((m) => m.sender_role === "customer" && !m.read_at).length;
  return 0;
}

export default function NotificationBell({ onClick }: { onClick: () => void }) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  async function fetchCount() {
    const ep = getMsgEndpoint();
    if (!ep) { setCount(0); return 0; }
    try {
      const raw = await api<any>(ep);
      const list = Array.isArray(raw) ? raw : (raw?.messages || []);
      const unread = countUnread(list);
      setCount(unread);
      return unread;
    } catch { return 0; }
  }

  useEffect(() => {
    fetchCount().then((c) => { prevRef.current = c; });
    const interval = setInterval(async () => {
      const c = await fetchCount();
      if (c > prevRef.current && prevRef.current > 0) {
        const diff = c - prevRef.current;
        if (diff > 0 && !("Notification" in window) || Notification.permission !== "granted") {
        }
      }
      prevRef.current = c;
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button type="button" onClick={onClick} style={{
      position: "relative", background: "none", border: "none", cursor: "pointer",
      fontSize: "1.2rem", lineHeight: 1, padding: "0.3rem 0.4rem", color: "var(--text)",
    }} aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}>
      🔔
      {count > 0 && <span style={{
        position: "absolute", top: 0, right: 0, transform: "translate(25%, -25%)",
        background: "#e53e3e", color: "#fff", borderRadius: 999,
        fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.35rem",
        lineHeight: 1.2, minWidth: 16, textAlign: "center",
      }}>{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
