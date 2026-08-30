import React, { useEffect, useRef, useState } from "react";
import { api, getCustomerToken, getProviderToken, getStaffToken } from "@/lib/api";
import Icon from "@/components/icons";

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
      if (document.visibilityState !== "visible") return;
      const c = await fetchCount();
      if (c > prevRef.current && prevRef.current >= 0) {
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      }
      prevRef.current = c;
    }, 10000);
    return () => { clearInterval(interval); };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`bell-btn${pulse ? " pulse" : ""}`}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
    >
      <Icon name="bell" size={18} />
      {count > 0 && <span className="bell-badge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
