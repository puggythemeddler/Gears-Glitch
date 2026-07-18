import React, { useEffect, useRef, useState } from "react";
import { api, getCustomerToken, getProviderToken, getStaffToken } from "@/lib/api";

function getMsgEndpoint(): string | null {
  if (getStaffToken()) return "/api/admin/messages";
  if (getCustomerToken()) return "/api/messages";
  if (getProviderToken()) return "/api/provider/messages";
  return null;
}

function countUnread(msgs: any[]): number {
  if (getStaffToken()) return msgs.filter((m) => m.sender_role !== "admin" && !m.read_at).length;
  if (getCustomerToken()) return msgs.filter((m) => m.sender_role !== "customer" && !m.read_at).length;
  if (getProviderToken()) return msgs.filter((m) => m.sender_role !== "provider" && !m.read_at).length;
  return 0;
}

export default function NotificationBell({ onClick }: { onClick: () => void }) {
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchCount(): Promise<number> {
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
      if (c > prevRef.current && prevRef.current >= 0) {
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      }
      prevRef.current = c;
    }, 10000);
    return () => { clearInterval(interval); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  return (
    <button type="button" onClick={onClick} style={{
      position: "relative", background: "none", border: "none", cursor: "pointer",
      fontSize: "1.2rem", lineHeight: 1, padding: "0.3rem 0.4rem", color: "var(--text)",
      animation: pulse ? "bellPulse 0.5s ease-in-out 3" : "none",
    }} aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}>
      🔔
      {count > 0 && <span style={{
        position: "absolute", top: 0, right: 0, transform: "translate(25%, -25%)",
        background: "#e53e3e", color: "#fff", borderRadius: 999,
        fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.35rem",
        lineHeight: 1.2, minWidth: 16, textAlign: "center",
      }}>{count > 99 ? "99+" : count}</span>}
      <style>{`@keyframes bellPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }`}</style>
    </button>
  );
}
